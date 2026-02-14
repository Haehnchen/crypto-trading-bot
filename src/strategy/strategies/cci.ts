/**
 * CCI Strategy - CCI overbought/oversold reversals with SMA200/EMA200 trend filter
 *
 * Long: CCI crosses above -100 from below (after reaching -200) when price > SMA200 or EMA200
 * Short: CCI crosses below 100 from above (after reaching 200) when price < SMA200 and EMA200
 * Close: CCI reverses from overbought/oversold zone
 */

import strategy, { StrategyBase, TypedStrategyContext, StrategySignal, type TypedIndicatorDefinition } from '../strategy';

// ============== Strategy Options ==============

export interface CciOptions {
  cci_length?: number;
  sma_length?: number;
  ema_length?: number;
}

// ============== Indicator Definition ==============

export type CciIndicators = {
  cci: TypedIndicatorDefinition<'cci'>;
  sma200: TypedIndicatorDefinition<'sma'>;
  ema200: TypedIndicatorDefinition<'ema'>;
};

// ============== Strategy Implementation ==============

export class Cci extends StrategyBase<CciIndicators, CciOptions> {
  getDescription(): string {
    return 'CCI overbought/oversold reversals with SMA200/EMA200 trend filter';
  }

  defineIndicators(): CciIndicators {
    return {
      cci: strategy.indicator.cci({ length: this.options.cci_length }),
      sma200: strategy.indicator.sma({ length: this.options.sma_length }),
      ema200: strategy.indicator.ema({ length: this.options.ema_length })
    };
  }

  async execute(context: TypedStrategyContext<CciIndicators>, signal: StrategySignal): Promise<void> {
    const price = context.price;

    const cciRaw = context.getIndicatorSlice('cci', 4);
    const sma200Raw = context.getIndicatorSlice('sma200', 3);
    const ema200Raw = context.getIndicatorSlice('ema200', 3);

    const cciValues = (Array.isArray(cciRaw) ? cciRaw.filter(v => v !== null) : []) as number[];
    const sma200Values = (Array.isArray(sma200Raw) ? sma200Raw.filter(v => v !== null) : []) as number[];
    const ema200Values = (Array.isArray(ema200Raw) ? ema200Raw.filter(v => v !== null) : []) as number[];

    if (cciValues.length < 2 || sma200Values.length < 2 || ema200Values.length < 2) {
      return;
    }

    const sma200 = sma200Values[sma200Values.length - 1];
    const ema200 = ema200Values[ema200Values.length - 1];
    const last = cciValues[cciValues.length - 1];
    const before = cciValues[cciValues.length - 2];

    signal.debugAll({
      sma200: Math.round(sma200 * 100) / 100,
      ema200: Math.round(ema200 * 100) / 100,
      cci: Math.round(last * 100) / 100
    });

    const lastSignal = context.lastSignal;

    // Trend change / close
    if (
      (lastSignal === 'long' && before > 100 && last < 100) ||
      (lastSignal === 'short' && before < -100 && last > -100)
    ) {
      signal.close();
      return;
    }

    // Trend filter: price above SMA200 or EMA200
    const isLong = price >= sma200 || price >= ema200;

    if (isLong) {
      // Long: CCI crosses above -100 after reaching -200
      if (before <= -100 && last >= -100) {
        let min = last;
        for (let i = cciValues.length - 2; i >= 0; i--) {
          if (cciValues[i] >= -100) break;
          if (cciValues[i] < min) min = cciValues[i];
        }
        if (min <= -200) {
          signal.debugAll({ _trigger: min });
          signal.goLong();
        }
      }
    } else {
      // Short: CCI crosses below 100 after reaching 200
      if (before >= 100 && last <= 100) {
        let max = last;
        for (let i = cciValues.length - 2; i >= 0; i--) {
          if (cciValues[i] <= 100) break;
          if (cciValues[i] > max) max = cciValues[i];
        }
        if (max >= 200) {
          signal.debugAll({ _trigger: max });
          signal.goShort();
        }
      }
    }
  }

  protected getDefaultOptions(): CciOptions {
    return {
      cci_length: 14,
      sma_length: 200,
      ema_length: 200
    };
  }
}
