/**
 * Parabolic SAR Strategy - Trend following with Parabolic SAR
 *
 * Long: Price crosses above PSAR (PSAR flips below price)
 * Short: Price crosses below PSAR (PSAR flips above price)
 * Close: PSAR flips against position
 */

import strategy, { StrategyBase, TypedStrategyContext, StrategySignal, type TypedIndicatorDefinition } from '../strategy';

// ============== Strategy Options ==============

export interface ParabolicSarOptions {
  step?: number;
  max?: number;
}

// ============== Indicator Definition ==============

export type ParabolicSarIndicators = {
  psar: TypedIndicatorDefinition<'psar'>;
};

// ============== Strategy Implementation ==============

export class ParabolicSar extends StrategyBase<ParabolicSarIndicators, ParabolicSarOptions> {
  getDescription(): string {
    return 'Parabolic SAR trend following strategy';
  }

  defineIndicators(): ParabolicSarIndicators {
    return {
      psar: strategy.indicator.psar({
        step: this.options.step,
        max: this.options.max
      })
    };
  }

  async execute(context: TypedStrategyContext<ParabolicSarIndicators>, signal: StrategySignal): Promise<void> {
    const psarRaw = context.getIndicatorSlice('psar', 3);
    const psarValues = (Array.isArray(psarRaw) ? psarRaw.filter(v => v !== null) : []) as number[];

    // Use actual close prices from context
    const prices = context.getLastPrices(3);

    if (psarValues.length < 2 || prices.length < 2) {
      return;
    }

    const currentPsar = psarValues[psarValues.length - 1];
    const previousPsar = psarValues[psarValues.length - 2];
    const currentClose = prices[prices.length - 1];
    const previousClose = prices[prices.length - 2];

    // Histogram: positive = price above PSAR (bullish), negative = price below PSAR (bearish)
    const currentHistogram = currentClose - currentPsar;
    const previousHistogram = previousClose - previousPsar;

    const isLong = currentHistogram > 0;
    const lastSignal = context.lastSignal;

    signal.debugAll({
      psar: Math.round(currentPsar * 100) / 100,
      histogram: Math.round(currentHistogram * 100) / 100,
      last_signal: lastSignal,
      long: isLong
    });

    // Trend change / close
    if (
      (lastSignal === 'long' && previousHistogram > 0 && currentHistogram < 0) ||
      (lastSignal === 'short' && previousHistogram < 0 && currentHistogram > 0)
    ) {
      signal.close();
      return;
    }

    if (isLong) {
      if (previousHistogram < 0 && currentHistogram > 0) {
        signal.goLong();
      }
    } else {
      if (previousHistogram > 0 && currentHistogram < 0) {
        signal.goShort();
      }
    }
  }

  protected getDefaultOptions(): ParabolicSarOptions {
    return {
      step: 0.02,
      max: 0.2
    };
  }
}
