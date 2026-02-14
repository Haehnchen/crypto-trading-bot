/**
 * Playground Strategy - V2
 *
 * Strategy: Heikin Ashi trend change detection with HMA filter
 * - Uses Heikin Ashi candles for trend detection
 * - HMA 400 as trend filter (long/short bias)
 * - Detects trend changes via consecutive candle patterns
 */

import strategy, { StrategyBase, TypedStrategyContext, StrategySignal, type TypedIndicatorDefinition, type HeikinAshiResult } from '../../../src/strategy/strategy';

// ============== Strategy Options ==============

export interface PlaygroundOptions {
  period?: '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
  hma_length?: number;
  ema_length?: number;
}

// ============== Indicator Definition ==============

export type PlaygroundIndicators = {
  heikin_ashi: TypedIndicatorDefinition<'heikin_ashi'>;
  hma: TypedIndicatorDefinition<'hma'>;
  ema: TypedIndicatorDefinition<'ema'>;
};

// ============== Strategy Implementation ==============

export class Playground extends StrategyBase<PlaygroundIndicators, PlaygroundOptions> {
  getDescription(): string {
    return 'Heikin Ashi trend change strategy with HMA filter - detects trend reversals using candle patterns';
  }

  defineIndicators(): PlaygroundIndicators {
    return {
      heikin_ashi: strategy.indicator.heikinAshi({}),
      hma: strategy.indicator.hma({
        length: this.options.hma_length,
        source: 'close'
      }),
      ema: strategy.indicator.ema({
        length: this.options.ema_length
      })
    };
  }

  /**
   * Detect trend change based on Heikin Ashi candle patterns
   * - 'up' trend: 3 bearish candles followed by 3 bullish candles
   * - 'down' trend: 3 bullish candles followed by 3 bearish candles
   */
  private trendChange(candles: HeikinAshiResult[], trend: 'up' | 'down'): boolean {
    const splice = candles.slice(-6);

    if (splice.length < 6) {
      return false;
    }

    if (trend === 'up') {
      // 3 bearish followed by 3 bullish
      if (splice[0].open > splice[0].close &&
          splice[1].open > splice[1].close &&
          splice[2].open > splice[2].close) {
        if (splice[3].close > splice[3].open &&
            splice[4].close > splice[4].open &&
            splice[5].close > splice[5].open) {
          return true;
        }
      }
    }

    if (trend === 'down') {
      // 3 bullish followed by 3 bearish
      if (splice[0].close > splice[0].open &&
          splice[1].close > splice[1].open &&
          splice[2].close > splice[2].open) {
        if (splice[3].open > splice[3].close &&
            splice[4].open > splice[4].close &&
            splice[5].open > splice[5].close) {
          return true;
        }
      }
    }

    return false;
  }

  async execute(context: TypedStrategyContext<PlaygroundIndicators>, signal: StrategySignal): Promise<void> {
    const price = context.price;

    // Get indicator arrays
    const hmaRaw = context.getIndicatorSlice('hma', 3);
    const haRaw = context.getIndicatorSlice('heikin_ashi', 10);

    // Filter out null values
    const hmaValues = (Array.isArray(hmaRaw) ? hmaRaw.filter(v => v !== null) : []) as number[];
    const haValues = (Array.isArray(haRaw) ? haRaw.filter(v => v !== null) : []) as HeikinAshiResult[];

    // Need HMA value and at least 6 HA candles
    if (hmaValues.length < 1 || haValues.length < 6) {
      return;
    }

    const currentHma = hmaValues[hmaValues.length - 1];

    // Trend filter: price above HMA = bullish bias
    const longBias = price >= currentHma;

    // Detect trend changes
    const trendUp = this.trendChange(haValues, 'up');
    const trendDown = this.trendChange(haValues, 'down');

    if (trendUp) {
      if (context.isShort()) {
        signal.close();
      } else if (longBias && context.isFlat()) {
        signal.goLong();
      }
    } else if (trendDown) {
      if (context.isLong()) {
        signal.close();
      } else if (!longBias && context.isFlat()) {
        signal.goShort();
      }
    }

    // Add debug info
    const latestHa = haValues[haValues.length - 1];
    signal.debugAll({
      price,
      hma: Math.round(currentHma * 100) / 100,
      ha_open: Math.round(latestHa.open * 100) / 100,
      ha_close: Math.round(latestHa.close * 100) / 100,
      long_bias: longBias,
      trend_up: trendUp,
      trend_down: trendDown
    });
  }

  protected getDefaultOptions(): PlaygroundOptions {
    return {
      period: '15m',
      hma_length: 400,
      ema_length: 2
    };
  }
}
