/**
 * Indicator Calculator - Delegates to shared indicator implementations
 * Returns candles paired with their indicator values (guaranteed alignment)
 */

import { indicators, sourceCandle, type Indicator } from '../../../utils/indicators';
import type { Candlestick } from '../../../dict/candlestick';
import type { TypedIndicatorDefinition } from '../../../strategy/strategy';

export interface CandleWithIndicators<T extends Record<string, TypedIndicatorDefinition>> {
  candle: Candlestick;
  indicators: Record<keyof T, any>;
}

/**
 * Calculate indicators and return paired with candles.
 *
 * @param candles - Must be sorted ascending (oldest first). Throws if descending.
 * @param definitions - Typed indicator definitions to compute.
 * @returns Array sorted ascending (oldest first), same order as input candles.
 *          Each element pairs the candle with all indicator values at that position.
 *          Indicator values are `null` during warmup period.
 */
export async function calculateIndicators<T extends Record<string, TypedIndicatorDefinition>>(
  candles: Candlestick[],
  definitions: T
): Promise<CandleWithIndicators<T>[]> {
  if (candles.length >= 2 && candles[0].time > candles[1].time) {
    throw new Error('Candles must be in ascending order (oldest first)');
  }

  // Calculate each indicator (returns shorter unpadded arrays)
  const indicatorArrays: Record<string, any[]> = {};

  for (const [key, def] of Object.entries(definitions)) {
    const name = def.name;

    if (!(name in indicators)) {
      throw new Error(`Unknown indicator: ${name}`);
    }

    const indicator: Indicator = {
      key: def.key || key,
      indicator: name,
      options: def.options || {}
    };

    const source = sourceCandle.includes(name as any) ? candles : candles.map(c => c.close);
    const rawResult = await (indicators as any)[name](source, indicator);
    const resultArray: any[] = rawResult[indicator.key];

    // Pad with nulls to match candle length
    const padding = candles.length - resultArray.length;
    indicatorArrays[key] = padding > 0 ? new Array(padding).fill(null).concat(resultArray) : resultArray;
  }

  // Zip candles with their indicator values
  const keys = Object.keys(definitions);
  return candles.map((candle, i) => ({
    candle,
    indicators: Object.fromEntries(keys.map(k => [k, indicatorArrays[k][i]])) as Record<keyof T, any>
  }));
}
