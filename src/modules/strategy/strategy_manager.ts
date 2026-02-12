import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import { IndicatorBuilder } from './dict/indicator_builder';
import { IndicatorPeriod } from './dict/indicator_period';
import * as ta from '../../utils/technical_analysis';
import { Resample } from '../../utils/resample';
import { CommonUtil } from '../../utils/common_util';
import { StrategyContext } from '../../dict/strategy_context';
import { Ticker } from '../../dict/ticker';
import { SignalResult } from './dict/signal_result';
import { Position } from '../../dict/position';
import type { Logger } from '../services';
import type { TechnicalAnalysisValidator } from '../../utils/technical_analysis_validator';
import type { ExchangeCandleCombine } from '../exchange/exchange_candle_combine';

export interface BacktestColumn {
  value: string | ((row: Record<string, any>) => any);
  type?: string;
  cross?: string;
  range?: number[];
}

export interface ColumnResult {
  value: string | number;
  type?: string;
  state?: string;
}

export interface StrategyExecuteResult {
  price?: number;
  columns?: ColumnResult[];
  result?: SignalResult;
}

export interface StrategyInfo {
  getName(): string;
  buildIndicator(indicatorBuilder: IndicatorBuilder, options?: Record<string, any>): void;
  period(indicatorPeriod: IndicatorPeriod, options?: Record<string, any>): Promise<SignalResult | undefined>;
  getBacktestColumns?(): BacktestColumn[];
  getOptions?(): Record<string, any>;
  getTickPeriod?(): string;
}

export class StrategyManager {
  private technicalAnalysisValidator: TechnicalAnalysisValidator;
  private exchangeCandleCombine: ExchangeCandleCombine;
  private projectDir: string;
  private logger: Logger;
  private strategies?: StrategyInfo[];

  constructor(technicalAnalysisValidator: TechnicalAnalysisValidator, exchangeCandleCombine: ExchangeCandleCombine, logger: Logger, projectDir: string) {
    this.technicalAnalysisValidator = technicalAnalysisValidator;
    this.exchangeCandleCombine = exchangeCandleCombine;
    this.projectDir = projectDir;

    this.logger = logger;
    this.strategies = undefined;
  }

  getStrategies(): StrategyInfo[] {
    if (typeof this.strategies !== 'undefined') {
      return this.strategies;
    }

    const strategies: StrategyInfo[] = [];

    const dirs = [`${__dirname}/strategies`, `${this.projectDir}/var/strategies`];

    const recursiveReadDirSyncWithDirectoryOnly = (p: string, a: string[] = []): string[] => {
      if (fs.statSync(p).isDirectory()) {
        fs.readdirSync(p)
          .filter(f => !f.startsWith('.') && fs.statSync(path.join(p, f)).isDirectory())
          .map(f => recursiveReadDirSyncWithDirectoryOnly(a[a.push(path.join(p, f)) - 1], a));
      }

      return a;
    };

    const supportedExtensions = ['.ts', '.js'];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        return;
      }

      fs.readdirSync(dir).forEach(file => {
        const ext = path.extname(file);
        if (supportedExtensions.includes(ext)) {
          const baseName = file.substring(0, file.length - ext.length);
          // Require without extension - ts-node will find .ts files automatically
          const modulePath = path.join(dir, baseName);
          const module = require(modulePath);
          // Handle both default exports (TypeScript) and direct exports (CommonJS)
          const StrategyClass = module.default || module;
          strategies.push(new StrategyClass());
        }
      });

      // Allow strategies to be wrapped by any folder depth:
      // "foo/bar" => "foo/bar/bar.ts" or "foo/bar/bar.js"
      recursiveReadDirSyncWithDirectoryOnly(dir).forEach(folder => {
        const baseName = path.basename(folder);
        const folderName = path.basename(folder);

        // Check if either .ts or .js file exists for this folder
        for (const ext of supportedExtensions) {
          const filename = path.join(folder, `${folderName}${ext}`);

          if (fs.existsSync(filename)) {
            // Require without extension - ts-node will handle it
            const modulePath = path.join(folder, folderName);
            const module = require(modulePath);
            // Handle both default exports (TypeScript) and direct exports (CommonJS)
            const StrategyClass = module.default || module;
            strategies.push(new StrategyClass());
            break; // Only load once, preferring .ts over .js
          }
        }
      });
    });

    return (this.strategies = strategies);
  }

  findStrategy(strategyName: string): StrategyInfo | undefined {
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
  async executeStrategy(
    strategyName: string,
    context: StrategyContext,
    exchange: string,
    symbol: string,
    options: Record<string, any>
  ): Promise<SignalResult | undefined> {
    const results = await this.getTaResult(strategyName, exchange, symbol, options, true);
    if (!results || Object.keys(results).length === 0) {
      return undefined;
    }

    // remove candle pipe
    delete results._candle;

    const indicatorPeriod = new IndicatorPeriod(context as any, results);

    const strategy = this.findStrategy(strategyName);
    if (!strategy) {
      return undefined;
    }

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
   * @returns {Promise<StrategyExecuteResult>}
   */
  async executeStrategyBacktest(
    strategyName: string,
    exchange: string,
    symbol: string,
    options: Record<string, any>,
    lastSignal: string,
    lastSignalEntry: number
  ): Promise<StrategyExecuteResult> {
    const results = await this.getTaResult(strategyName, exchange, symbol, options);
    if (!results || Object.keys(results).length === 0) {
      return {};
    }

    const price = results._candle ? results._candle.close : undefined;

    let context: StrategyContext;
    if (lastSignal && lastSignalEntry && price) {
      // provide a suitable value; its just backtesting
      const amount = lastSignal === 'short' ? -1 : 1;
      const positionSide = lastSignal === 'short' ? 'short' : 'long';

      context = StrategyContext.createFromPosition(
        options,
        new Ticker(exchange, symbol, undefined, price, price),
        new Position(
          symbol,
          positionSide,
          amount,
          CommonUtil.getProfitAsPercent(positionSide, price, lastSignalEntry),
          new Date(),
          lastSignalEntry,
          new Date()
        ),
        true
      );
    } else {
      context = StrategyContext.create(options, new Ticker(exchange, symbol, undefined, price, price), true);
    }

    context.lastSignal = lastSignal;

    const indicatorPeriod = new IndicatorPeriod(context as any, results);

    const strategy = this.getStrategies().find(s => s.getName() === strategyName);
    if (!strategy) {
      return {};
    }

    const strategyResult = await strategy.period(indicatorPeriod, options);

    if (typeof strategyResult !== 'undefined' && !(strategyResult instanceof SignalResult)) {
      throw new Error(`Invalid strategy return:${strategyName}`);
    }

    const result: StrategyExecuteResult = {
      price: price,
      columns: this.getCustomTableColumnsForRow(strategyName, strategyResult ? strategyResult.getDebug() : {})
    };

    if (strategyResult) {
      result.result = strategyResult;
    }

    return result;
  }

  async getTaResult(
    strategyName: string,
    exchange: string,
    symbol: string,
    options: Record<string, any>,
    validateLookbacks: boolean = false
  ): Promise<Record<string, any>> {
    options = options || {};

    const strategy = this.getStrategies().find(s => {
      return s.getName() === strategyName;
    });

    if (!strategy) {
      throw new Error(`invalid strategy: ${strategyName}`);
    }

    const indicatorBuilder = new IndicatorBuilder();
    strategy.buildIndicator(indicatorBuilder, options);

    const periodGroups: Record<string, any[]> = {};

    indicatorBuilder.all().forEach(indicator => {
      if (!periodGroups[indicator.period]) {
        periodGroups[indicator.period] = [];
      }

      periodGroups[indicator.period].push(indicator);
    });

    const results: Record<string, any> = {};

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

      const lookbacks = await this.exchangeCandleCombine.fetchCombinedCandles(exchange, symbol, period, foreignExchanges, olderThenCurrentPeriod);

      if (lookbacks[exchange] && lookbacks[exchange].length > 0) {
        // check if candle to close time is outside our allow time window
        if (validateLookbacks && !this.technicalAnalysisValidator.isValidCandleStickLookback(lookbacks[exchange].slice(), period)) {
          this.logger.info(`Strategy skipped: outdated candle sticks: ${JSON.stringify([period, strategyName, exchange, symbol])}`);

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
        if (!lookbacks[foreignExchange.name + foreignExchange.symbol] || lookbacks[foreignExchange.name + foreignExchange.symbol].length === 0) {
          continue;
        }

        const indicators = periodGroup.filter(group => group.options.exchange === foreignExchange.name);
        if (indicators.length === 0) {
          continue;
        }

        const result = await ta.createIndicatorsLookback(lookbacks[foreignExchange.name + foreignExchange.symbol].slice().reverse(), indicators);

        // array merge
        for (const x in result) {
          results[x] = result[x];
        }
      }
    }

    return results;
  }

  getCustomTableColumnsForRow(strategyName: string, row: Record<string, any>): ColumnResult[] {
    return this.getBacktestColumns(strategyName).map(cfg => {
      // direct value of array or callback
      const value = typeof cfg.value === 'function' ? cfg.value(row) : _.get(row, cfg.value);

      let valueOutput: string | number;

      if (typeof value !== 'undefined') {
        switch (typeof value) {
          case 'object':
            valueOutput = Object.keys(value).length === 0 ? '' : JSON.stringify(value);

            break;
          case 'string':
            valueOutput = value as string;

            break;
          default:
            valueOutput = new Intl.NumberFormat('en-US', {
              minimumSignificantDigits: 3,
              maximumSignificantDigits: 4
            }).format(value as number);
            break;
        }
      } else {
        valueOutput = '';
      }

      const result: ColumnResult = {
        value: valueOutput,
        type: cfg.type || 'default'
      };

      switch (cfg.type || 'default') {
        case 'cross':
          result.state = value > _.get(row, cfg.cross || '') ? 'over' : 'below';
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

  getStrategyNames(): string[] {
    return this.getStrategies().map(strategy => strategy.getName());
  }

  getBacktestColumns(strategyName: string): BacktestColumn[] {
    const strategy = this.getStrategies().find(s => {
      return s.getName() === strategyName;
    });

    if (!strategy) {
      return [];
    }

    return typeof strategy.getBacktestColumns !== 'undefined' ? strategy.getBacktestColumns() : [];
  }
}
