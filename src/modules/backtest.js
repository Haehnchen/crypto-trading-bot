const moment = require('moment');
const _ = require('lodash');
const StrategyManager = require('./strategy/strategy_manager');
const Resample = require('../utils/resample');

module.exports = class Backtest {
  constructor(instances, strategyManager, exchangeCandleCombine, projectDir) {
    this.instances = instances;
    this.strategyManager = strategyManager;
    this.exchangeCandleCombine = exchangeCandleCombine;
    this.projectDir = projectDir;
  }

  getBacktestPairs() {
    const pairs = [];

    this.instances.symbols.forEach(symbol => {
      pairs.push(`${symbol.exchange}.${symbol.symbol}`);
    });

    return pairs.sort();
  }

  getBacktestStrategies() {
    return this.strategyManager.getStrategies().map(strategy => {
      return {
        name: strategy.getName(),
        options: typeof strategy.getOptions !== 'undefined' ? strategy.getOptions() : undefined
      };
    });
  }

  getBacktestResult(tickIntervalInMinutes, hours, strategy, candlePeriod, exchange, pair, options,initial_capital) {
    return new Promise(async resolve => {
      const start = moment()
        .startOf('hour')
        .subtract(hours * 60, 'minutes')
        .unix();

      // collect candles for cart and allow a prefill of eg 200 candles for our indicators starts

      const rows = [];
      let current = start;
      let lastSignal;

      // mock repository for window selection of candles
      const periodCache = {};
      const prefillWindow = start - Resample.convertPeriodToMinute(candlePeriod) * 200 * 60;
      const mockedRepository = {
        fetchCombinedCandles: async (mainExchange, symbol, period, exchanges = []) => {
          const key = mainExchange + symbol + period;
          if (!periodCache[key]) {
            periodCache[key] = await this.exchangeCandleCombine.fetchCombinedCandlesSince(
              mainExchange,
              symbol,
              period,
              exchanges,
              prefillWindow
            );
          }

          const filter = {};
          for (const ex in periodCache[key]) {
            filter[ex] = periodCache[key][ex].slice().filter(candle => candle.time < current);
          }

          return filter;
        }
      };

      const end = moment().unix();
      while (current < end) {
        const strategyManager = new StrategyManager({}, mockedRepository, {}, this.projectDir);

        const item = await strategyManager.executeStrategyBacktest(strategy, exchange, pair, options, lastSignal);
        item.time = current;

        // so change in signal
        let currentSignal = item.result ? item.result.getSignal() : undefined;
        if (currentSignal === lastSignal) {
          currentSignal = undefined;
        }

        if (['long', 'short'].includes(currentSignal)) {
          lastSignal = currentSignal;
        } else if (currentSignal === 'close') {
          lastSignal = undefined;
        }

        rows.push(item);

        current += tickIntervalInMinutes * 60;
      }

      const signals = rows.slice().filter(r => r.result && r.result.getSignal());

      const dates = {};

      signals.forEach(signal => {
        if (!dates[signal.time]) {
          dates[signal.time] = [];
        }

        dates[signal.time].push(signal);
      });

      const exchangeCandles = await mockedRepository.fetchCombinedCandles(exchange, pair, candlePeriod);
      const candles = exchangeCandles[exchange]
        .filter(c => c.time > start)
        .map(candle => {
          let signals;

          for (const time in JSON.parse(JSON.stringify(dates))) {
            if (time >= candle.time) {
              signals = dates[time].map(i => {
                return {
                  signal: i.result.getSignal()
                };
              });
              delete dates[time];
            }
          }

          return {
            date: new Date(candle.time * 1000),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            signals: signals
          };
        });
      
      let backtestSummary = await this.getBacktestSummary(signals,initial_capital)
      resolve({
        summary : backtestSummary,
        rows: rows.slice().reverse(),
        signals: signals.slice().reverse(),
        candles: JSON.stringify(candles),
        extra_fields: this.strategyManager.getBacktestColumns(strategy),
        configuration: {
          exchange: exchange,
          symbol: pair,
          period: candlePeriod
        }
      });
    });
  }

  getBacktestSummary(signals,initial_capital) {
    return new Promise(async resolve => {

      let initialCapital = Number(initial_capital);           //1000 $ Initial Capital
      let workingCapital = initialCapital;  //Capital that changes after every trade
      
      let lastPosition;                     //Holds Info about last action
      
      let averagePNLPercent = 0;            //Average ROI or PNL Percentage

      let trades = {                        
        profitableCount: 0,                 //Number of Profitable Trades
        lossMakingCount: 0,                 //Number of Trades that caused a loss
        total: 0,                           //Totol number of Trades
        profitabilityPercent: 0             //Percentage Of Trades that were profitable
      }

      let cumulativePNLPercent = 0;         //Sum of all the PNL Percentages
      let pnlRateArray = [];                //Array of all PNL Percentages of all the trades
      
      //Iterate over all the signals
      for (let s = 0; s < signals.length; s++) {

        let signalObject = signals[s]
        let signalType = signalObject.result._signal      // Can be long,short,close


        //When a trade is closed
        if (signalType == "close") {

          //Increment the total trades counter
          trades.total = trades.total + 1

          //Entry Position Details
          let entrySignalType = lastPosition.result._signal                       //Long or Short
          let entryPrice = lastPosition.price                                     //Price during the trade entry
          let tradedQuantity = Number((workingCapital / entryPrice).toFixed(2))   //Quantity

          //Exit Details
          let exitPrice = signalObject.price                                      //Price during trade exit
          let exitValue = Number((tradedQuantity * exitPrice).toFixed(2))         //Price * Quantity

          //Trade Details
          let pnlValue = 0                                                        // Profit or Loss Value

          //When the position is Long
          if (entrySignalType == "long") {

            if (exitPrice > entryPrice) {
              //Long Trade is Profitable
              trades.profitableCount = trades.profitableCount + 1
            }

            //Set the PNL
            pnlValue = exitValue - workingCapital
            
          } else if (entrySignalType == "short") {

            if (exitPrice < entryPrice) {
              //Short Trade is Profitable
              trades.profitableCount = trades.profitableCount + 1
            }

            //Set the PNL
            pnlValue = - (exitValue - workingCapital)
          }

          
          //Percentage Return
          let pnlPercent = Number(((pnlValue / workingCapital)*100).toFixed(2));

          //Summation of Percentage Return
          cumulativePNLPercent = cumulativePNLPercent + pnlPercent;
          
          //Maintaining the Percentage array
          pnlRateArray.push(pnlPercent)

          //Update Working Cap
          workingCapital = workingCapital + pnlValue
        }
        else if (signalType == "long" || signalType == "short") {
          //Enter into a position
          lastPosition = signalObject;
        }


      }

      //Lossmaking Trades
      trades.lossMakingCount = trades.total - trades.profitableCount

      // Calculating the Sharpe Ratio ----------------------------------------------------------
      
      //Average PNL Percent
      averagePNLPercent = Number((cumulativePNLPercent/trades.total).toFixed(2))

      //Initialize Sum of Mean Square Differences
      let msdSum = 0
      
      //(Mean - value)^2
      for(let p=0;p<pnlRateArray.length;p++){
        //Sum of Mean Square Differences
        msdSum = msdSum + Number(((averagePNLPercent - pnlRateArray[p])^2).toFixed(2))
      }

      let variance = Number((msdSum/trades.total).toFixed(2))   // Variance

      let stdDeviation = Math.sqrt(variance)                    //STD Deviation from the mean

      //TODO:  Test the Sharpe Ratio
      let sharpeRatio = Number(((averagePNLPercent-3.0)/stdDeviation).toFixed(2))
      
      // -- End of Sharpe Ratio Calculation


      //Net Profit
      let netProfit = Number((((workingCapital - initialCapital) / initialCapital) * 100).toFixed(2))

      trades.profitabilityPercent = Number((trades.profitableCount*100/trades.total).toFixed(2))

      let summary = {
        sharpeRatio:sharpeRatio,
        averagePNLPercent:averagePNLPercent,
        netProfit: netProfit,
        initialCapital: initialCapital,
        finalCapital: Number(workingCapital.toFixed(2)),
        trades: trades
      }

      resolve(summary)
    })
  }
};
