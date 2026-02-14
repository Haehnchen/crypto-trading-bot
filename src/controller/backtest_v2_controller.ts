/**
 * Backtest V2 Controller - Web UI controller for typed strategy backtests
 */

import { BaseController, TemplateHelpers } from './base_controller';
import { TypedBacktestEngine, type BacktestResult, type BacktestSummary, type BacktestTrade, type BacktestRow } from '../modules/strategy/v2/typed_backtest';
import { StrategyRegistry, type StrategyName } from '../modules/strategy/v2/strategy_registry';
import type { Period } from '../strategy/strategy';
import type express from 'express';
import type { ExchangeCandleCombine } from '../modules/exchange/exchange_candle_combine';

// Chart data format for the view
interface CandleChartData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  signals: { signal: string }[];
}

export interface BacktestV2Pair {
  name: string;
  options: string[];
}

export interface BacktestV2StrategyInfo {
  name: string;
  displayName: string;
  description: string;
  defaultOptions: Record<string, any>;
}

export interface BacktestV2Request {
  exchange: string;
  symbol: string;
  period: Period;
  hours: number;
  strategy: StrategyName;
  initialCapital: number;
  options?: Record<string, any>;
}

/**
 * Build candle chart data from backtest result (presentation logic)
 */
function buildCandleChartData(result: BacktestResult): CandleChartData[] {
  const candleByTime = new Map(result.candlesAsc.map(c => [c.time, c]));

  return result.rows.map(row => {
    const signals: { signal: string }[] = [];
    if (row.signal) {
      signals.push({ signal: row.signal });
    }

    const candle = candleByTime.get(row.time);
    return {
      date: new Date(row.time * 1000).toISOString(),
      open: candle?.open ?? row.price,
      high: candle?.high ?? row.price,
      low: candle?.low ?? row.price,
      close: row.price,
      volume: candle?.volume ?? 0,
      signals
    };
  });
}

export class BacktestV2Controller extends BaseController {
  private engine: TypedBacktestEngine;

  constructor(
    templateHelpers: TemplateHelpers,
    private exchangeCandleCombine: ExchangeCandleCombine,
    private instances: { symbols: { exchange: string; symbol: string }[] },
    private strategyRegistry: StrategyRegistry
  ) {
    super(templateHelpers);
    this.engine = new TypedBacktestEngine(exchangeCandleCombine);
  }

  registerRoutes(router: express.Router): void {
    // Backtest v2 form page
    router.get('/backtest/v2', async (req: express.Request, res: express.Response) => {
      res.render('backtest_v2', {
        activePage: 'backtest',
        title: 'Backtesting V2 | Crypto Bot',
        stylesheet: '<link rel="stylesheet" href="/css/backtest.css?v=' + this.templateHelpers.assetVersion() + '">',
        strategies: this.getStrategies(),
        pairs: await this.getBacktestPairs(),
        periods: ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']
      });
    });

    // Backtest v2 submit
    router.post('/backtest/v2/submit', async (req: express.Request, res: express.Response) => {
      try {
        const { pair, candle_period, hours, strategy, initial_capital, options } = req.body;

        // Parse pair (format: "exchange.symbol")
        const [exchange, symbol] = pair.split('.');

        // Validate strategy
        if (!this.strategyRegistry.isValidStrategy(strategy)) {
          res.status(400).json({ error: `Invalid strategy: ${strategy}` });
          return;
        }

        // Run backtest
        const result = await this.runBacktest({
          exchange,
          symbol,
          period: candle_period as Period,
          hours: parseInt(hours, 10),
          strategy: strategy as StrategyName,
          initialCapital: parseFloat(initial_capital) || 1000,
          options: options ? JSON.parse(options) : undefined
        });

        // Render result
        res.render('backtest_v2_result', {
          activePage: 'backtest',
          title: 'Backtest Results | Crypto Bot',
          stylesheet: '<link rel="stylesheet" href="/css/backtest.css?v=' + this.templateHelpers.assetVersion() + '">',
          ...this.formatResultForView(result)
        });
      } catch (error) {
        console.error('Backtest error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // API endpoint for programmatic access
    router.post('/api/backtest/v2', async (req: express.Request, res: express.Response) => {
      try {
        const { exchange, symbol, period, hours, strategy, initialCapital, options } = req.body as BacktestV2Request;

        // Validate
        if (!this.strategyRegistry.isValidStrategy(strategy)) {
          res.status(400).json({ error: `Invalid strategy: ${strategy}` });
          return;
        }

        const result = await this.runBacktest({
          exchange,
          symbol,
          period: period as Period,
          hours,
          strategy: strategy as StrategyName,
          initialCapital: initialCapital || 1000,
          options
        });

        res.json(result);
      } catch (error) {
        console.error('API backtest error:', error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Get available strategies (API)
    router.get('/api/backtest/v2/strategies', (_req: express.Request, res: express.Response) => {
      res.json(this.getStrategies());
    });
  }

  /**
   * Get all available v2 strategies
   */
  getStrategies(): BacktestV2StrategyInfo[] {
    return this.strategyRegistry.getAllStrategyInfo().map(info => {
      // Get default options by creating an instance with empty options
      const StrategyClass = this.strategyRegistry.getStrategyClass(info.name);
      // @ts-ignore - Create with empty options to get defaults
      const instance = new StrategyClass({});
      const defaultOptions = instance.getOptions?.() || {};

      return {
        ...info,
        defaultOptions
      };
    });
  }

  /**
   * Get available pairs for backtest dropdown
   */
  async getBacktestPairs(): Promise<BacktestV2Pair[]> {
    const pairs = this.instances.symbols.map(symbol => ({
      name: `${symbol.exchange}.${symbol.symbol}`,
      options: ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d']
    }));

    return pairs.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Run a backtest with the v2 engine
   */
  async runBacktest(request: BacktestV2Request): Promise<BacktestResult> {
    const { exchange, symbol, period, hours, strategy, initialCapital, options } = request;

    // Create strategy instance (period NOT in options - it's passed to defineIndicators)
    const strategyInstance = this.strategyRegistry.createStrategy(strategy, {
      amount_currency: initialCapital.toString(),
      ...options
    });

    // Run backtest
    return this.engine.run(strategyInstance, {
      exchange,
      symbol,
      period,
      hours,
      initialCapital
    });
  }

  /**
   * Format backtest result for view template
   */
  private formatResultForView(result: BacktestResult) {
    return {
      strategyName: result.strategyName,
      exchange: result.exchange,
      symbol: result.symbol,
      period: result.period,
      startTime: result.startTime,
      endTime: result.endTime,

      // Summary
      summary: {
        netProfit: result.summary.totalProfitPercent,
        initialCapital: 1000, // TODO: track this
        finalCapital: 1000 * (1 + result.summary.totalProfitPercent / 100),
        sharpeRatio: result.summary.sharpeRatio,
        averagePNLPercent: result.summary.averageProfitPercent,
        trades: {
          total: result.summary.totalTrades,
          profitableCount: result.summary.profitableTrades,
          lossMakingCount: result.summary.losingTrades,
          profitabilityPercent: result.summary.winRate
        },
        maxDrawdown: result.summary.maxDrawdown
      },

      // Trades for table
      trades: result.trades.map(trade => ({
        entryTime: new Date(trade.entryTime * 1000),
        exitTime: new Date(trade.exitTime * 1000),
        entryPrice: trade.entryPrice,
        exitPrice: trade.exitPrice,
        side: trade.side,
        profitPercent: trade.profitPercent,
        profitAbsolute: trade.profitAbsolute
      })),

      // Rows for signal history table
      rows: result.rows,

      // Indicator keys for display
      indicatorKeys: result.indicatorKeys,

      // Candles for chart (JSON string for data attribute) - built from raw data
      candles: JSON.stringify(buildCandleChartData(result))
    };
  }
}
