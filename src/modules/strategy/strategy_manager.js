const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const IndicatorBuilder = require('./dict/indicator_builder');
const IndicatorPeriod = require('./dict/indicator_period');
const ta = require('../../utils/technical_analysis');
const Resample = require('../../utils/resample');
const CommonUtil = require('../../utils/common_util');
const StrategyContext = require('../../dict/strategy_context');
const Ticker = require('../../dict/ticker');
const SignalResult = require('./dict/signal_result');
const Position = require('../../dict/position');

module.exports = class StrategyManager {
  constructor(technicalAnalysisValidator, exchangeCandleCombine, logger, projectDir) {
    this.technicalAnalysisValidator = technicalAnalysisValidator;
    this.exchangeCandleCombine = exchangeCandleCombine;
    this.projectDir = projectDir;

    this.logger = logger;
    this.strategies = undefined;
  }

  getStrategies() {
    if (typeof this.strategies !== 'undefined') {
      return this.strategies;
    }

    const strategies = [];

    const dirs = [`${__dirname}/strategies`, `${this.projectDir}/var/strategies`];

    const recursiveReadDirSyncWithDirectoryOnly = (p, a = []) => {
      if (fs.statSync(p).isDirectory()) {
        fs.readdirSync(p)
          .filter(f => !f.startsWith('.') && fs.statSync(path.join(p, f)).isDirectory())
          .map(f => recursiveReadDirSyncWithDirectoryOnly(a[a.push(path.join(p, f)) - 1], a));
      }

      return a;
    };

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        return;
      }

      fs.readdirSync(dir).forEach(file => {
        if (file.endsWith('.js')) {
          strategies.push(new (require(`${dir}/${file.substr(0, file.length - 3)}`))());
        }
      });

      // Allow strategies to be wrapped by any folder depth:
      // "foo/bar" => "foo/bar/bar.js"
      recursiveReadDirSyncWithDirectoryOnly(dir).forEach(folder => {
        const filename = `${folder}/${path.basename(folder)}.js`;

        if (fs.existsSync(filename)) {
          strategies.push(new (require(filename))());
        }
      });
    });

    return (this.strategies = strategies);
  }

  findStrategy(strategyName) {
    return this.getStrategies().find(strategy => strategy.getName() === strategyName);
  }

  /**
   *
   * @param strategyName
   * @param context
   * @param exchange
   * @param symbol
   * @param options
   * @returns {Promise<SignalResult|undefined>}
   */
  async executeStrategy(strategyName, context, exchange, symbol, options) {
    const results = await this.getTaResult(strategyName, exchange, symbol, options, true);
    if (!results || Object.keys(results).length === 0) {
      return undefined;
    }

    // remove candle pipe
    delete results._candle;

    const indicatorPeriod = new IndicatorPeriod(context, results);

    const strategy = this.findStrategy(strategyName);

    const strategyResult = await strategy.period(indicatorPeriod, options);
    if (typeof strategyResult !== 'undefined' && !(strategyResult instanceof SignalResult)) {
      throw new Error(`Invalid strategy return:${strategyName}`);
    }

    return strategyResult;
  }

  /**
   * @param strategyName
   * @param exchange
   * @param symbol
   * @param options
   * @param lastSignal
   * @param lastSignalEntry
   * @returns {Promise<array>}
   */
  async executeStrategyBacktest(strategyName, exchange, symbol, options, lastSignal, lastSignalEntry) {
    const results = await this.getTaResult(strategyName, exchange, symbol, options);
    if (!results || Object.keys(results).length === 0) {
      return {};
    }

    const price = results._candle ? results._candle.close : undefined;

    let context;
    if (lastSignal && lastSignalEntry && price) {
      // provide a suitable value; its just backtesting
      const amount = lastSignal === 'short' ? -1 : 1;

      context = StrategyContext.createFromPosition(
        options,
        new Ticker(exchange, symbol, undefined, price, price),
        new Position(
          symbol,
          lastSignal,
          amount,
          CommonUtil.getProfitAsPercent(lastSignal, price, lastSignalEntry),
          undefined,
          lastSignalEntry
        ),
        true
      );
    } else {
      context = StrategyContext.create(options, new Ticker(exchange, symbol, undefined, price, price), true);
    }

    context.lastSignal = lastSignal;

    const indicatorPeriod = new IndicatorPeriod(context, results);

    const strategy = this.getStrategies().find(strategy => strategy.getName() === strategyName);
    const strategyResult = await strategy.period(indicatorPeriod, options);

    if (typeof strategyResult !== 'undefined' && !(strategyResult instanceof SignalResult)) {
      throw `Invalid strategy return:${strategyName}`;
    }

    const result = {
      price: price,
      columns: this.getCustomTableColumnsForRow(strategyName, strategyResult ? strategyResult.getDebug() : {})
    };

    if (strategyResult) {
      result.result = strategyResult;
    }

    return result;
  }

  async getTaResult(strategyName, exchange, symbol, options, validateLookbacks = false) {
    options = options || {};

    const strategy = this.getStrategies().find(strategy => {
      return strategy.getName() === strategyName;
    });

    if (!strategy) {
      throw `invalid strategy: ${strategy}`;
    }

    const indicatorBuilder = new IndicatorBuilder();
    strategy.buildIndicator(indicatorBuilder, options);

    const periodGroups = {};

    indicatorBuilder.all().forEach(indicator => {
      if (!periodGroups[indicator.period]) {
        periodGroups[indicator.period] = [];
      }

      periodGroups[indicator.period].push(indicator);
    });

    const results = {};

    for (const period in periodGroups) {
      const periodGroup = periodGroups[period];

      const foreignExchanges = [
        ...new Set(
          periodGroup
            .filter(group => group.options.exchange && group.options.symbol)
            .map(group => {
              return `${group.options.exchange}#${group.options.symbol}`;
            })
        )
      ].map(exchange => {
        const e = exchange.split('#');

        return {
          name: e[0],
          symbol: e[1]
        };
      });

      // filter candles in the futures: eg current non closed candle
      const periodAsMinute = Resample.convertPeriodToMinute(period) * 60;
      const unixtime = Math.floor(Date.now() / 1000);
      const olderThenCurrentPeriod = unixtime - (unixtime % periodAsMinute) - periodAsMinute * 0.1;

      const lookbacks = await this.exchangeCandleCombine.fetchCombinedCandles(
        exchange,
        symbol,
        period,
        foreignExchanges,
        olderThenCurrentPeriod
      );

      if (lookbacks[exchange].length > 0) {
        // check if candle to close time is outside our allow time window
        if (
          validateLookbacks &&
          !this.technicalAnalysisValidator.isValidCandleStickLookback(lookbacks[exchange].slice(), period)
        ) {
          this.logger.info(
            `Strategy skipped: outdated candle sticks: ${JSON.stringify([period, strategyName, exchange, symbol])}`
          );

          // stop current run
          return {};
        }

        const indicators = periodGroup.filter(group => !group.options.exchange && !group.options.symbol);

        const result = await ta.createIndicatorsLookback(lookbacks[exchange].slice().reverse(), indicators);

        // array merge
        for (const x in result) {
          results[x] = result[x];
        }

        results._candle = lookbacks[exchange][0];
      }

      for (const foreignExchange of foreignExchanges) {
        if (
          !lookbacks[foreignExchange.name + foreignExchange.symbol] ||
          lookbacks[foreignExchange.name + foreignExchange.symbol].length === 0
        ) {
          continue;
        }

        const indicators = periodGroup.filter(group => group.options.exchange === foreignExchange.name);
        if (indicators.length === 0) {
          continue;
        }

        const result = await ta.createIndicatorsLookback(
          lookbacks[foreignExchange.name + foreignExchange.symbol].slice().reverse(),
          indicators
        );

        // array merge
        for (const x in result) {
          results[x] = result[x];
        }
      }
    }

    return results;
  }

  getCustomTableColumnsForRow(strategyName, row) {
    return this.getBacktestColumns(strategyName).map(cfg => {
      // direct value of array or callback
      const value = typeof cfg.value === 'function' ? cfg.value(row) : _.get(row, cfg.value);

      let valueOutput = value;

      if (typeof value !== 'undefined') {
        switch (typeof value) {
          case 'object':
            valueOutput = Object.keys(value).length === 0 ? '' : JSON.stringify(value);

            break;
          case 'string':
            valueOutput = value;

            break;
          default:
            valueOutput = new Intl.NumberFormat('en-US', {
              minimumSignificantDigits: 3,
              maximumSignificantDigits: 4
            }).format(value);
            break;
        }
      }

      const result = {
        value: valueOutput,
        type: cfg.type || 'default'
      };

      switch (cfg.type || 'default') {
        case 'cross':
          result.state = value > _.get(row, cfg.cross) ? 'over' : 'below';
          break;
        case 'histogram':
          result.state = value > 0 ? 'over' : 'below';
          break;
        case 'oscillator':
          if (value > (cfg.range && cfg.range.length > 0 ? cfg.range[0] : 80)) {
            result.state = 'over';
          } else if (value < (cfg.range && cfg.range.length > 1 ? cfg.range[1] : 20)) {
            result.state = 'below';
          }
          break;
      }

      return result;
    });
  }

  getStrategyNames() {
    return this.getStrategies().map(strategy => strategy.getName());
  }

  getBacktestColumns(strategyName) {
    const strategy = this.getStrategies().find(strategy => {
      return strategy.getName() === strategyName;
    });

    if (!strategy) {
      return [];
    }

    return typeof strategy.getBacktestColumns !== 'undefined' ? strategy.getBacktestColumns() : [];
  }
};
