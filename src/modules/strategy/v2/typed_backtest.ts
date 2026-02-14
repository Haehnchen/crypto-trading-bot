/**
 * Strategy Execution Engine - Core execution logic reusable for backtest and live trading
 */

import { TypedStrategyContext, StrategySignal, type TypedIndicatorDefinition, type Period, type TypedStrategy } from '../../../strategy/strategy';
import { calculateIndicators } from './indicator_calculator';
import { convertPeriodToMinute } from '../../../utils/resample';
import type { ExchangeCandleCombine } from '../../exchange/exchange_candle_combine';
import type { Candlestick } from '../../../dict/candlestick';

// ============== Core Signal Types (reusable for trading) ==============

/**
 * Result of executing strategy on a single candle
 */
export interface SignalRow {
  time: number;
  price: number;
  signal?: 'long' | 'short' | 'close';
  debug: Record<string, any>;
}

// ============== Backtest-specific Types ==============

export interface BacktestConfig {
  exchange: string;
  symbol: string;
  period: Period;
  initialCapital: number;
}

export interface BacktestConfigWithHours extends BacktestConfig {
  hours: number;
}

export interface BacktestTrade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  side: 'long' | 'short';
  profitPercent: number;
  profitAbsolute: number;
}

export interface BacktestSummary {
  totalTrades: number;
  profitableTrades: number;
  losingTrades: number;
  winRate: number;
  totalProfitPercent: number;
  averageProfitPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface BacktestRow extends SignalRow {
  position?: 'long' | 'short' | null;
  profitPercent?: number;
}

export interface BacktestResult {
  strategyName: string;
  symbol: string;
  exchange: string;
  period: string;
  startTime: Date;
  endTime: Date;
  summary: BacktestSummary;
  trades: BacktestTrade[];
  rows: BacktestRow[];
  indicatorKeys: string[];
  candlesAsc: Candlestick[];
}

// ============== Core Strategy Executor (reusable for trading) ==============

export class StrategyExecutor {
  /**
   * Execute strategy on candles and return raw signals
   * This is the core method reusable for both backtesting and live trading
   */
  async execute<TIndicators extends Record<string, TypedIndicatorDefinition>>(
    strategyInstance: TypedStrategy<TIndicators>,
    candlesAsc: Candlestick[]
  ): Promise<SignalRow[]> {
    // Validate candles are in ascending order (oldest first)
    if (candlesAsc.length >= 2 && candlesAsc[0].time > candlesAsc[1].time) {
      throw new Error('Candles must be in ascending order (oldest first). Received descending order.');
    }

    const indicatorDefinitions = strategyInstance.defineIndicators();
    const combined = await calculateIndicators(candlesAsc, indicatorDefinitions);

    const rows: SignalRow[] = [];
    const indicatorArrays: Record<string, any[]> = {};
    const priceHistory: number[] = [];

    for (const key of Object.keys(indicatorDefinitions)) {
      indicatorArrays[key] = [];
    }

    // Track lastSignal internally - piped through each iteration
    let lastSignal: 'long' | 'short' | 'close' | undefined = undefined;

    for (const entry of combined) {
      const { candle, indicators: indicatorValues } = entry;

      // Push current values into accumulated arrays
      for (const key of Object.keys(indicatorDefinitions)) {
        indicatorArrays[key].push(indicatorValues[key]);
      }
      priceHistory.push(candle.close);

      // Create context with current lastSignal so strategy can close itself
      const context = new TypedStrategyContext<TIndicators>(
        candle.close,
        indicatorArrays as any,
        lastSignal,
        priceHistory
      );

      // Execute strategy
      const signalBuilder = new StrategySignal();
      try {
        await strategyInstance.execute(context, signalBuilder);
      } catch (error) {
        console.error(`Strategy error at ${new Date(candle.time * 1000).toISOString()}:`, error);
        continue;
      }

      const signal = signalBuilder.signal;

      // Record signal row
      rows.push({
        time: candle.time,
        price: candle.close,
        signal,
        debug: signalBuilder.getDebug()
      });

      // Update lastSignal for next iteration
      if (signal) {
        lastSignal = signal;
      }
    }

    return rows;
  }
}

// ============== Backtest Engine (backtest-specific logic) ==============

export class TypedBacktestEngine {
  private executor: StrategyExecutor;

  constructor(
    private exchangeCandleCombine: ExchangeCandleCombine
  ) {
    this.executor = new StrategyExecutor();
  }

  /**
   * Run a backtest with pre-fetched candles
   * Use this when candles are already available (e.g., from live trading)
   */
  async runWithCandles<TIndicators extends Record<string, TypedIndicatorDefinition>>(
    strategyInstance: TypedStrategy<TIndicators>,
    candlesAsc: Candlestick[],
    config: BacktestConfig
  ): Promise<BacktestResult> {
    // Validate candles are in ascending order (oldest first)
    if (candlesAsc.length >= 2 && candlesAsc[0].time > candlesAsc[1].time) {
      throw new Error('Candles must be in ascending order (oldest first). Received descending order.');
    }

    const { exchange, symbol, period, initialCapital } = config;

    // Execute strategy to get signals
    const signalRows = await this.executor.execute(strategyInstance, candlesAsc);

    // Process signals into trades and calculate profits
    const { backtestRows, trades, summary } = this.processSignals(signalRows, initialCapital);

    // Get indicator keys from strategy
    const indicatorDefinitions = strategyInstance.defineIndicators();

    // Calculate time range from candles
    const startTime = candlesAsc.length > 0 ? candlesAsc[0].time : 0;
    const endTime = candlesAsc.length > 0 ? candlesAsc[candlesAsc.length - 1].time : 0;

    // Get strategy name from constructor name
    const strategyName = strategyInstance.constructor?.name || 'unknown';

    return {
      strategyName,
      symbol,
      exchange,
      period,
      startTime: new Date(startTime * 1000),
      endTime: new Date(endTime * 1000),
      summary,
      trades,
      rows: backtestRows,
      indicatorKeys: Object.keys(indicatorDefinitions),
      candlesAsc
    };
  }

  /**
   * Run a backtest for a typed strategy (fetches candles automatically)
   */
  async run<TIndicators extends Record<string, TypedIndicatorDefinition>>(
    strategyInstance: TypedStrategy<TIndicators>,
    config: BacktestConfigWithHours
  ): Promise<BacktestResult> {
    const { exchange, symbol, period, hours, initialCapital } = config;

    // Calculate time range
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - hours * 3600;
    const prefillTime = startTime - 200 * convertPeriodToMinute(period) * 60;

    // Fetch candles
    const candleData = await this.exchangeCandleCombine.fetchCombinedCandlesSince(
      exchange,
      symbol,
      period,
      [],
      prefillTime
    );

    const candles = candleData[exchange] || [];

    if (candles.length === 0) {
      throw new Error(`No candles found for ${exchange}:${symbol}:${period}`);
    }

    const candlesAsc = candles.slice().reverse();

    // Delegate to runWithCandles
    return this.runWithCandles(strategyInstance, candlesAsc, {
      exchange,
      symbol,
      period,
      initialCapital
    });
  }

  /**
   * Process signals into trades and calculate backtest metrics
   * This is backtest-specific logic
   */
  private processSignals(
    signalRows: SignalRow[],
    initialCapital: number
  ): { backtestRows: BacktestRow[]; trades: BacktestTrade[]; summary: BacktestSummary } {
    const backtestRows: BacktestRow[] = [];
    const trades: BacktestTrade[] = [];

    let currentPosition: { side: 'long' | 'short'; entryPrice: number; entryTime: number } | null = null;
    let capital = initialCapital;
    let peakCapital = initialCapital;
    let maxDrawdown = 0;

    for (const row of signalRows) {
      // Calculate current profit
      let profitPercent: number | undefined;
      if (currentPosition) {
        if (currentPosition.side === 'long') {
          profitPercent = ((row.price - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
        } else {
          profitPercent = ((currentPosition.entryPrice - row.price) / currentPosition.entryPrice) * 100;
        }

        // Track drawdown
        const currentCapital = capital * (1 + profitPercent / 100);
        if (currentCapital > peakCapital) {
          peakCapital = currentCapital;
        }
        const drawdown = ((peakCapital - currentCapital) / peakCapital) * 100;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }

      // Record backtest row with position and profit
      backtestRows.push({
        ...row,
        position: currentPosition?.side || null,
        profitPercent
      });

      // Process signal into trade
      if (row.signal === 'long' && !currentPosition) {
        currentPosition = { side: 'long', entryPrice: row.price, entryTime: row.time };
      } else if (row.signal === 'short' && !currentPosition) {
        currentPosition = { side: 'short', entryPrice: row.price, entryTime: row.time };
      } else if (row.signal === 'close' && currentPosition) {
        const tradeProfit = profitPercent!;

        trades.push({
          entryTime: currentPosition.entryTime,
          exitTime: row.time,
          entryPrice: currentPosition.entryPrice,
          exitPrice: row.price,
          side: currentPosition.side,
          profitPercent: tradeProfit,
          profitAbsolute: capital * (tradeProfit / 100)
        });

        capital *= 1 + tradeProfit / 100;
        currentPosition = null;
      }
    }

    // Close any open position at the end
    const lastRow = backtestRows[backtestRows.length - 1];
    if (currentPosition && lastRow) {
      let tradeProfit: number;
      if (currentPosition.side === 'long') {
        tradeProfit = ((lastRow.price - currentPosition.entryPrice) / currentPosition.entryPrice) * 100;
      } else {
        tradeProfit = ((currentPosition.entryPrice - lastRow.price) / currentPosition.entryPrice) * 100;
      }

      trades.push({
        entryTime: currentPosition.entryTime,
        exitTime: lastRow.time,
        entryPrice: currentPosition.entryPrice,
        exitPrice: lastRow.price,
        side: currentPosition.side,
        profitPercent: tradeProfit,
        profitAbsolute: capital * (tradeProfit / 100)
      });
    }

    // Calculate summary
    const profitableTrades = trades.filter(t => t.profitPercent > 0).length;
    const losingTrades = trades.filter(t => t.profitPercent <= 0).length;
    const totalProfitPercent = ((capital - initialCapital) / initialCapital) * 100;
    const avgProfit = trades.length > 0
      ? trades.reduce((sum, t) => sum + t.profitPercent, 0) / trades.length
      : 0;

    const returns = trades.map(t => t.profitPercent);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance = returns.length > 1
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (avgReturn - 3) / stdDev : 0;

    const summary: BacktestSummary = {
      totalTrades: trades.length,
      profitableTrades,
      losingTrades,
      winRate: trades.length > 0 ? (profitableTrades / trades.length) * 100 : 0,
      totalProfitPercent,
      averageProfitPercent: avgProfit,
      maxDrawdown,
      sharpeRatio
    };

    return { backtestRows, trades, summary };
  }
}
