/**
 * Awesome Oscillator Cross Zero Strategy - AO crossing zero with SMA200 trend filter
 *
 * Long: AO crosses above 0 when price >= SMA200
 * Short: AO crosses below 0 when price < SMA200
 * Close: AO reverses against position
 */

import strategy, { StrategyBase, TypedStrategyContext, StrategySignal, type TypedIndicatorDefinition } from '../strategy';

// ============== Strategy Options ==============

export interface AwesomeOscillatorOptions {
  sma_length?: number;
}

// ============== Indicator Definition ==============

export type AwesomeOscillatorIndicators = {
  ao: TypedIndicatorDefinition<'ao'>;
  sma200: TypedIndicatorDefinition<'sma'>;
};

// ============== Strategy Implementation ==============

export class AwesomeOscillatorCrossZero extends StrategyBase<AwesomeOscillatorIndicators, AwesomeOscillatorOptions> {
  getDescription(): string {
    return 'Awesome Oscillator crossing zero with SMA200 trend filter';
  }

  defineIndicators(): AwesomeOscillatorIndicators {
    return {
      ao: strategy.indicator.ao(),
      sma200: strategy.indicator.sma({ length: this.options.sma_length })
    };
  }

  async execute(context: TypedStrategyContext<AwesomeOscillatorIndicators>, signal: StrategySignal): Promise<void> {
    const price = context.price;

    const aoRaw = context.getIndicatorSlice('ao', 3);
    const sma200Raw = context.getIndicatorSlice('sma200', 3);

    const aoValues = (Array.isArray(aoRaw) ? aoRaw.filter(v => v !== null) : []) as number[];
    const sma200Values = (Array.isArray(sma200Raw) ? sma200Raw.filter(v => v !== null) : []) as number[];

    if (aoValues.length < 2 || sma200Values.length < 2) {
      return;
    }

    const sma200 = sma200Values[sma200Values.length - 1];
    const last = aoValues[aoValues.length - 1];
    const before = aoValues[aoValues.length - 2];

    const lastSignal = context.lastSignal;

    signal.debugAll({
      sma200: Math.round(sma200 * 100) / 100,
      ao: Math.round(last * 100) / 100,
      last_signal: lastSignal
    });

    // Trend change / close
    if (
      (lastSignal === 'long' && before > 0 && last < 0) ||
      (lastSignal === 'short' && before < 0 && last > 0)
    ) {
      signal.close();
      return;
    }

    const isLong = price >= sma200;

    if (isLong) {
      if (before < 0 && last > 0) {
        signal.goLong();
      }
    } else {
      if (before > 0 && last < 0) {
        signal.goShort();
      }
    }
  }

  protected getDefaultOptions(): AwesomeOscillatorOptions {
    return {
      sma_length: 200
    };
  }
}
