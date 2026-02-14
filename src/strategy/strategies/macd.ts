/**
 * MACD Strategy - MACD histogram crossover with HMA/SMA200 trend filter
 *
 * Long: MACD histogram crosses above 0 when HMA >= SMA200
 * Short: MACD histogram crosses below 0 when HMA < SMA200
 * Close: Histogram reverses against position
 */

import strategy, { StrategyBase, TypedStrategyContext, StrategySignal, type TypedIndicatorDefinition, type MacdResult } from '../strategy';

// ============== Strategy Options ==============

export interface MacdStrategyOptions {
  default_ma_type?: string;
  fast_period?: number;
  slow_period?: number;
  signal_period?: number;
  hma_length?: number;
  sma_length?: number;
}

// ============== Indicator Definition ==============

export type MacdIndicators = {
  macd: TypedIndicatorDefinition<'macd_ext'>;
  hma: TypedIndicatorDefinition<'hma'>;
  sma200: TypedIndicatorDefinition<'sma'>;
};

// ============== Strategy Implementation ==============

export class Macd extends StrategyBase<MacdIndicators, MacdStrategyOptions> {
  getDescription(): string {
    return 'MACD histogram crossover with HMA/SMA200 trend filter';
  }

  defineIndicators(): MacdIndicators {
    return {
      macd: strategy.indicator.macdExt({
        default_ma_type: this.options.default_ma_type,
        fast_period: this.options.fast_period,
        slow_period: this.options.slow_period,
        signal_period: this.options.signal_period
      }),
      hma: strategy.indicator.hma({ length: this.options.hma_length }),
      sma200: strategy.indicator.sma({ length: this.options.sma_length })
    };
  }

  async execute(context: TypedStrategyContext<MacdIndicators>, signal: StrategySignal): Promise<void> {
    const macdRaw = context.getIndicatorSlice('macd', 3);
    const hmaRaw = context.getIndicatorSlice('hma', 2);
    const sma200Raw = context.getIndicatorSlice('sma200', 2);

    const macdValues = (Array.isArray(macdRaw) ? macdRaw.filter(v => v !== null) : []) as MacdResult[];
    const hmaValues = (Array.isArray(hmaRaw) ? hmaRaw.filter(v => v !== null) : []) as number[];
    const sma200Values = (Array.isArray(sma200Raw) ? sma200Raw.filter(v => v !== null) : []) as number[];

    if (macdValues.length < 2 || hmaValues.length < 1 || sma200Values.length < 1) {
      return;
    }

    const hma = hmaValues[hmaValues.length - 1];
    const sma200 = sma200Values[sma200Values.length - 1];
    const current = macdValues[macdValues.length - 1].histogram;
    const before = macdValues[macdValues.length - 2].histogram;

    const isLong = hma >= sma200;
    const lastSignal = context.lastSignal;

    signal.debugAll({
      sma200: Math.round(sma200 * 100) / 100,
      histogram: Math.round(current * 100) / 100,
      last_signal: lastSignal,
      long: isLong
    });

    // Trend change / close
    if (
      (lastSignal === 'long' && before > 0 && current < 0) ||
      (lastSignal === 'short' && before < 0 && current > 0)
    ) {
      signal.close();
      return;
    }

    if (isLong) {
      if (before < 0 && current > 0) {
        signal.goLong();
      }
    } else {
      if (before > 0 && current < 0) {
        signal.goShort();
      }
    }
  }

  protected getDefaultOptions(): MacdStrategyOptions {
    return {
      default_ma_type: 'EMA',
      fast_period: 12,
      slow_period: 26,
      signal_period: 9,
      hma_length: 9,
      sma_length: 200
    };
  }
}
