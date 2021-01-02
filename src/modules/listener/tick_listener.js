const moment = require('moment');
const _ = require('lodash');
const StrategyContext = require('../../dict/strategy_context');
const Order = require('../../dict/order');
const OrderCapital = require('../../dict/order_capital');

module.exports = class TickListener {
  constructor(
    tickers,
    instances,
    notifier,
    signalLogger,
    strategyManager,
    exchangeManager,
    pairStateManager,
    logger,
    systemUtil,
    orderExecutor,
    orderCalculator
  ) {
    this.tickers = tickers;
    this.instances = instances;
    this.notifier = notifier;
    this.signalLogger = signalLogger;
    this.strategyManager = strategyManager;
    this.exchangeManager = exchangeManager;
    this.pairStateManager = pairStateManager;
    this.logger = logger;
    this.systemUtil = systemUtil;
    this.orderExecutor = orderExecutor;
    this.orderCalculator = orderCalculator;

    this.notified = {};
  }

  async visitStrategy(strategy, symbol) {
    const ticker = this.tickers.get(symbol.exchange, symbol.symbol);

    if (!ticker) {
      console.error(`Ticker no found for + ${symbol.exchange}${symbol.symbol}`);
      return;
    }

    const strategyKey = strategy.strategy;

    let context = StrategyContext.create(strategy.options, ticker, true);
    const position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol);
    if (position) {
      context = StrategyContext.createFromPosition(strategy.options, ticker, position, true);
    }

    const result = await this.strategyManager.executeStrategy(
      strategyKey,
      context,
      symbol.exchange,
      symbol.symbol,
      strategy.options || {}
    );
    if (!result) {
      return;
    }

    const signal = result.getSignal();
    if (!signal || typeof signal === 'undefined') {
      return;
    }

    if (!['close', 'short', 'long'].includes(signal)) {
      throw Error(`Invalid signal: ${JSON.stringify(signal, strategy)}`);
    }

    const signalWindow = moment()
      .subtract(30, 'minutes')
      .toDate();

    if (
      this.notified[symbol.exchange + symbol.symbol + strategyKey] &&
      signalWindow <= this.notified[symbol.exchange + symbol.symbol + strategyKey]
    ) {
      // console.log('blocked')
    } else {
      this.notified[symbol.exchange + symbol.symbol + strategyKey] = new Date();
      this.notifier.send(`[${signal} (${strategyKey})` + `] ${symbol.exchange}:${symbol.symbol} - ${ticker.ask}`);

      // log signal
      this.signalLogger.signal(
        symbol.exchange,
        symbol.symbol,
        {
          price: ticker.ask,
          strategy: strategyKey,
          raw: JSON.stringify(result)
        },
        signal,
        strategyKey
      );
    }
  }

  async visitTradeStrategy(strategy, symbol) {
    const ticker = this.tickers.get(symbol.exchange, symbol.symbol);

    if (!ticker) {
      console.error(`Ticker no found for + ${symbol.exchange}${symbol.symbol}`);
      return;
    }

    const strategyKey = strategy.strategy;

    let context = StrategyContext.create(strategy.options, ticker);
    const position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol);
    if (position) {
      context = StrategyContext.createFromPosition(strategy.options, ticker, position);
    }

    const result = await this.strategyManager.executeStrategy(
      strategyKey,
      context,
      symbol.exchange,
      symbol.symbol,
      strategy.options || {}
    );

    if (!result) {
      return;
    }

    // handle orders inside strategy
    const placedOrder = result.getPlaceOrder();
    if (placedOrder.length > 0) {
      await this.placeStrategyOrders(placedOrder, symbol);
    }

    const signal = result.getSignal();
    if (!signal || typeof signal === 'undefined') {
      return;
    }

    if (!['close', 'short', 'long'].includes(signal)) {
      throw Error(`Invalid signal: ${JSON.stringify(signal, strategy)}`);
    }

    const signalWindow = moment()
      .subtract(_.get(symbol, 'trade.signal_slowdown_minutes', 15), 'minutes')
      .toDate();

    const noteKey = symbol.exchange + symbol.symbol;
    if (noteKey in this.notified && this.notified[noteKey] >= signalWindow) {
      return;
    }

    // log signal
    this.logger.info(
      [new Date().toISOString(), signal, strategyKey, symbol.exchange, symbol.symbol, ticker.ask].join(' ')
    );
    this.notifier.send(`[${signal} (${strategyKey})] ${symbol.exchange}:${symbol.symbol} - ${ticker.ask}`);
    this.signalLogger.signal(
      symbol.exchange,
      symbol.symbol,
      {
        price: ticker.ask,
        strategy: strategyKey,
        raw: JSON.stringify(result)
      },
      signal,
      strategyKey
    );
    this.notified[noteKey] = new Date();

    await this.pairStateManager.update(symbol.exchange, symbol.symbol, signal);
  }

  async placeStrategyOrders(placedOrder, symbol) {
    for (const order of placedOrder) {
      const amount = await this.orderCalculator.calculateOrderSizeCapital(
        symbol.exchange,
        symbol.symbol,
        OrderCapital.createCurrency(order.amount_currency)
      );

      const exchangeOrder = Order.createLimitPostOnlyOrder(symbol.symbol, Order.SIDE_LONG, order.price, amount);

      await this.orderExecutor.executeOrderWithAmountAndPrice(symbol.exchange, exchangeOrder);
    }
  }

  async startStrategyIntervals() {
    this.logger.info(`Starting strategy intervals`);

    const me = this;

    const types = [
      {
        name: 'watch',
        items: this.instances.symbols.filter(sym => sym.strategies && sym.strategies.length > 0)
      },
      {
        name: 'trade',
        items: this.instances.symbols.filter(
          sym => sym.trade && sym.trade.strategies && sym.trade.strategies.length > 0
        )
      }
    ];

    types.forEach(type => {
      me.logger.info(`Strategy: "${type.name}" found "${type.items.length}" valid symbols`);

      type.items.forEach(symbol => {
        // map strategies
        let strategies = [];
        if (type.name === 'watch') {
          strategies = symbol.strategies;
        } else if (type.name === 'trade') {
          strategies = symbol.trade.strategies;
        }

        strategies.forEach(strategy => {
          let myInterval = '1m';

          if (strategy.interval) {
            myInterval = strategy.interval;
          } else {
            const strategyInstance = me.strategyManager.findStrategy(strategy.strategy);
            if (typeof strategyInstance.getTickPeriod === 'function') {
              myInterval = strategyInstance.getTickPeriod();
            }
          }

          const [timeout, interval] = me.getFirstTimeoutAndInterval(myInterval);

          // random add 5-15 sec to init start for each to not run all at same time
          const timeoutWindow = timeout + (Math.floor(Math.random() * 9000) + 5000);

          me.logger.info(
            `"${symbol.exchange}" - "${symbol.symbol}" - "${type.name}" - init strategy "${
              strategy.strategy
            }" (${myInterval}) in ${(timeoutWindow / 60 / 1000).toFixed(3)} minutes`
          );

          const strategyIntervalCallback = async () => {
            /*
            // logging can be high traffic on alot of pairs
            me.logger.debug(
              `"${symbol.exchange}" - "${symbol.symbol}" - "${type.name}" strategy running "${strategy.strategy}"`
            );
            */

            if (type.name === 'watch') {
              await me.visitStrategy(strategy, symbol);
            } else if (type.name === 'trade') {
              await me.visitTradeStrategy(strategy, symbol);
            } else {
              throw new Error(`Invalid strategy type${type.name}`);
            }
          };

          setTimeout(() => {
            me.logger.info(
              `"${symbol.exchange}" - "${symbol.symbol}" - "${type.name}" first strategy run "${
                strategy.strategy
              }" now every ${(interval / 60 / 1000).toFixed(2)} minutes`
            );

            // first run call
            setTimeout(async () => {
              await strategyIntervalCallback();
            }, 1000 + Math.floor(Math.random() * (800 - 300 + 1)) + 100);

            // continuous run
            setInterval(async () => {
              await strategyIntervalCallback();
            }, interval);
          }, timeoutWindow);
        });
      });
    });
  }

  getFirstTimeoutAndInterval(period) {
    const unit = period.slice(-1).toLowerCase();
    let myUnit = 0;
    switch (unit) {
      case 's':
        myUnit = 1;
        break;
      case 'm':
        myUnit = 60;
        break;
      default:
        throw Error(`Unsupported period unit: ${period}`);
    }

    const number = parseInt(period.substring(0, period.length - 1), 10);
    return [this.getFirstRun(number, myUnit), number * myUnit * 1000];
  }

  getFirstRun(minutes, unit) {
    const interval = minutes * unit * 1000;
    const number = Math.ceil(new Date().getTime() / interval) * interval;
    return new Date(number).getTime() - new Date().getTime();
  }
};
