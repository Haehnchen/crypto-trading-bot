/**
 * Dip Catcher Strategy - HMA/BB retracement catcher with Ichimoku trend
 *
 * Long: HMA(low) crosses above BB lower when Ichimoku trend is bullish
 * Short: HMA(high) crosses below BB upper when Ichimoku trend is bearish
 * Close: Opposite crossover occurs while in position
 */

import strategy, { StrategyBase, TypedStrategyContext, StrategySignal, type TypedIndicatorDefinition, type BollingerBandsResult, type IchimokuCloudResult } from '../../strategy';

// ============== Strategy Options ==============

export interface DipCatcherOptions {
  trend_cloud_multiplier?: number;
  hma_high_period?: number;
  hma_high_candle_source?: string;
  hma_low_period?: number;
  hma_low_candle_source?: string;
  hma_length?: number;
  bb_length?: number;
}

// ============== Indicator Definition ==============

export type DipCatcherIndicators = {
  hma_high: TypedIndicatorDefinition<'hma'>;
  hma_low: TypedIndicatorDefinition<'hma'>;
  hma: TypedIndicatorDefinition<'hma'>;
  cloud: TypedIndicatorDefinition<'ichimoku_cloud'>;
  bb: TypedIndicatorDefinition<'bb'>;
};

// ============== Strategy Implementation ==============

export class DipCatcher extends StrategyBase<DipCatcherIndicators, DipCatcherOptions> {
  getDescription(): string {
    return 'HMA/BB retracement catcher with Ichimoku cloud trend filter';
  }

  defineIndicators(): DipCatcherIndicators {
    const trendCloudMultiplier = this.options.trend_cloud_multiplier || 4;

    return {
      hma_high: strategy.indicator.hma({
        length: this.options.hma_high_period,
        source: this.options.hma_high_candle_source
      }),
      hma_low: strategy.indicator.hma({
        length: this.options.hma_low_period,
        source: this.options.hma_low_candle_source
      }),
      hma: strategy.indicator.hma({
        length: this.options.hma_length
      }),
      cloud: strategy.indicator.ichimokuCloud({
        conversionPeriod: 9 * trendCloudMultiplier,
        basePeriod: 26 * trendCloudMultiplier,
        spanPeriod: 52 * trendCloudMultiplier,
        displacement: 26 * trendCloudMultiplier
      }),
      bb: strategy.indicator.bb({
        length: this.options.bb_length
      })
    };
  }

  async execute(context: TypedStrategyContext<DipCatcherIndicators>, signal: StrategySignal): Promise<void> {
    const hmaRaw = context.getIndicatorSlice('hma', 3);
    const hmaLowRaw = context.getIndicatorSlice('hma_low', 3);
    const hmaHighRaw = context.getIndicatorSlice('hma_high', 3);
    const bbRaw = context.getIndicatorSlice('bb', 3);
    const cloudRaw = context.getIndicatorSlice('cloud', 2);

    const hmaValues = (Array.isArray(hmaRaw) ? hmaRaw.filter(v => v !== null) : []) as number[];
    const hmaLowValues = (Array.isArray(hmaLowRaw) ? hmaLowRaw.filter(v => v !== null) : []) as number[];
    const hmaHighValues = (Array.isArray(hmaHighRaw) ? hmaHighRaw.filter(v => v !== null) : []) as number[];
    const bbValues = (Array.isArray(bbRaw) ? bbRaw.filter(v => v !== null) : []) as BollingerBandsResult[];
    const cloudValues = (Array.isArray(cloudRaw) ? cloudRaw.filter(v => v !== null) : []) as IchimokuCloudResult[];

    if (hmaValues.length < 1 || hmaLowValues.length < 2 || hmaHighValues.length < 2 || bbValues.length < 2 || cloudValues.length < 1) {
      return;
    }

    const hma = hmaValues[hmaValues.length - 1];
    const cloud = cloudValues[cloudValues.length - 1];

    const hmaLow0 = hmaLowValues[hmaLowValues.length - 1];
    const hmaLow1 = hmaLowValues[hmaLowValues.length - 2];
    const hmaHigh0 = hmaHighValues[hmaHighValues.length - 1];
    const hmaHigh1 = hmaHighValues[hmaHighValues.length - 2];
    const bb0 = bbValues[bbValues.length - 1];
    const bb1 = bbValues[bbValues.length - 2];

    const lastSignal = context.lastSignal;
    const isLong = hma > cloud.spanB;

    signal.debugAll({
      hma: Math.round(hma * 100) / 100,
      cloud_spanB: Math.round(cloud.spanB * 100) / 100,
      bb_lower: Math.round(bb0.lower * 100) / 100,
      bb_upper: Math.round(bb0.upper * 100) / 100,
      trend: isLong
    });

    if (hmaLow0 > bb0.lower && hmaLow1 < bb1.lower) {
      if (!lastSignal && isLong) {
        signal.debugAll({ message: 'long_lower_cross' });
        signal.goLong();
      } else if (lastSignal) {
        signal.close();
      }
    }

    if (hmaHigh0 < bb0.upper && hmaHigh1 > bb1.upper) {
      if (!lastSignal && !isLong) {
        signal.debugAll({ message: 'short_upper_cross' });
        signal.goShort();
      } else if (lastSignal) {
        signal.close();
      }
    }
  }

  protected getDefaultOptions(): DipCatcherOptions {
    return {
      trend_cloud_multiplier: 4,
      hma_high_period: 9,
      hma_high_candle_source: 'close',
      hma_low_period: 9,
      hma_low_candle_source: 'close',
      hma_length: 9,
      bb_length: 20
    };
  }
}
