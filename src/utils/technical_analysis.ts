const tulind = require('tulind');
const indicatorsModule = require('./indicators');
const indicators = indicatorsModule.default || indicatorsModule.indicators;
const { sourceCandle } = indicatorsModule;
const IndicatorBuilder = require('../modules/strategy/dict/indicator_builder');

export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorResult {
  [key: string]: any;
  candles: Candlestick[];
}

export interface IndicatorDefinition {
  key: string;
  indicator: string | Function;
  source?: string;
  options?: any;
}

export interface PivotPointsResult {
  high?: number;
  low?: number;
}

export interface PivotPointsWithWicksResult {
  high?: {
    close?: number;
    high?: number;
  };
  low?: {
    close?: number;
    low?: number;
  };
}

/**
 * https://www.tradingview.com/wiki/Bollinger_Bands_%25B_(%25B)
 */
export function getBollingerBandPercent(currentPrice: number, upper: number, lower: number): number {
  return (currentPrice - lower) / (upper - lower);
}

/**
 * https://www.tradingview.com/wiki/Bollinger_Bands_%25B_(%25B)
 */
export function getPercentTrendStrength(lookbackPrices: number[]): number | undefined {
  if (lookbackPrices.length < 9) {
    return undefined;
  }

  const slice = lookbackPrices.slice(-4);
  console.log(slice);

  const b = slice[slice.length - 1] - slice[0];

  console.log(b);

  console.log((Math.atan2(3, b) * 180) / Math.PI);

  return 0; // FIXME: implementation seems broken in original code
}

/**
 * @param canles
 * @param lenght
 */
export function candles2MarketData(
  candles: Candlestick[],
  length: number = 1000,
  keys: string[] = ['open', 'close', 'high', 'low', 'volume']
): Record<string, number[]> {
  return keys.reduce((acc, k) => ({ ...acc, [k]: candles.slice(-length).map(c => (c as any)[k]) }), {} as Record<string, number[]>);
}

/**
 * @param lookbacks oldest first
 */
export function getPredefinedIndicators(lookbacks: Candlestick[]): Promise<IndicatorResult> {
  return new Promise(resolve => {

    const indicators = new IndicatorBuilder();
    indicators.add('sma_200', 'sma', undefined, { length: 200 });
    indicators.add('sma_50', 'sma', undefined, { length: 50 });
    indicators.add('ema_55', 'ema', undefined, { length: 55 });
    indicators.add('ema_200', 'ema', undefined, { length: 200 });
    indicators.add('rsi', 'rsi', undefined, { length: 14 });
    indicators.add('cci', 'cci', undefined, { length: 20 });
    indicators.add('ao', 'ao');
    indicators.add('macd', 'macd', undefined, { fast_length: 12, slow_length: 26, signal_length: 9 });
    indicators.add('mfi', 'mfi', undefined, { length: 14 });
    indicators.add('bollinger_bands', 'bb', undefined, { length: 20, stddev: 2 });
    indicators.add('stoch_rsi', 'stoch_rsi', undefined, { rsi_length: 14, stoch_length: 14, k: 3, d: 3 });
    indicators.add('wicked', 'wicked');

    const results = createIndicatorsLookback(lookbacks, indicators.all());
    resolve(results);
  });
}

/**
 * Function called from createIndicatorsLookback, several times.
 * Calculates only "Ready" indicators, with calculated source data
 */
export function calculateReadyIndicators(indicatorsList: IndicatorDefinition[], results: any): any[] {
  return indicatorsList
    .map(indicator => (
      { ...indicator, source: indicator.source || (sourceCandle.includes(indicator.indicator) ? 'candles' : 'close') })) // figure out indicator source
    .filter(({ key }) => !(key in results)) // skip already calculated indicators
    .filter(({ source }) => source in results.candles[0] || source in results) // skip without source data
    .map(indicator => {

      const { indicator: indicatorName, source } = indicator;

      // Extract source from candle if it's candle data
      const sourceData = source in results.candles[0] ? results.candles.map((v: any) => v[source]) : results[source];

      if (typeof indicatorName === 'function') {
        return indicatorName(sourceData, indicator);
      }
      if (typeof indicatorName === 'string' && typeof indicators[indicatorName] === 'function') {
        return indicators[indicatorName](sourceData, indicator);
      }
      throw Error(`Call to undefined indicator: ${JSON.stringify(indicator)}`);
    });
}

/**
 * @param indicators
 * @param lookbacks oldest first
 */
export async function createIndicatorsLookback(lookbacks: Candlestick[], indicators: IndicatorDefinition[]): Promise<IndicatorResult> {
  if (lookbacks.length > 1 && lookbacks[0].time > lookbacks[1].time) {
    throw Error(`'Invalid candlestick order`);
  }

  let calculations: any = { candles: lookbacks.slice(-1000) };
  for (let depth = 0; depth < 5; depth += 1) {
    const values = await Promise.all(calculateReadyIndicators(indicators, calculations));
    calculations = Object.assign(calculations, ...values);
  }

  return calculations;
}

export function getTrendingDirection(lookbacks: number[]): string {
  const currentValue = lookbacks.slice(-1)[0];

  return (lookbacks[lookbacks.length - 2] + lookbacks[lookbacks.length - 3] + lookbacks[lookbacks.length - 4]) / 3 >
    currentValue
    ? 'down'
    : 'up';
}

export function getTrendingDirectionLastItem(lookbacks: number[]): string {
  return lookbacks[lookbacks.length - 2] > lookbacks[lookbacks.length - 1] ? 'down' : 'up';
}

export function getCrossedSince(lookbacks: number[]): number | undefined {
  const values = lookbacks.slice().reverse();
  const currentValue = values[0];

  for (let i = 1; i < values.length - 1; i++) {
    if (currentValue < 0 && values[i] > 0 || currentValue >= 0 && values[i] < 0) {
      return i;
    }
  }

  return undefined;
}

/**
 * Find the pivot points on the given window with "left" and "right". If "right" or "left" values are higher this point is invalidated
 *
 * https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/pivot-points-high-low
 */
export function getPivotPoints(prices: number[], left: number, right: number): PivotPointsResult {
  if (left + right + 1 > prices.length || left <= 1 || right < 0) {
    return {};
  }

  // get range from end
  const range = prices.slice(-(left + right + 1));

  const middleValue = range[left];

  const result: PivotPointsResult = {};

  const leftRange = range.slice(0, left);
  const rightRange = range.slice(-right);

  if (
    typeof leftRange.find(c => c > middleValue) === 'undefined' &&
    typeof rightRange.find(c => c > middleValue) === 'undefined'
  ) {
    result.high = middleValue;
  }

  if (
    typeof leftRange.find(c => c < middleValue) === 'undefined' &&
    typeof rightRange.find(c => c < middleValue) === 'undefined'
  ) {
    result.low = middleValue;
  }

  return result;
}

/**
 * Get the pivot points high and low with the candle wicks to get a range
 *
 * { high: { close: 5, high: 6 } }
 * { low: { close: 5, low: 4 } }
 *
 * https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/pivot-points-high-low
 */
export function getPivotPointsWithWicks(candles: Candlestick[], left: number, right: number): PivotPointsWithWicksResult {
  if (left + right + 1 > candles.length || left <= 1 || right < 0) {
    return {};
  }

  // get range from end
  const range = candles.slice(-(left + right + 1));

  const result: PivotPointsWithWicksResult = {};
  for (const source of ['close', 'high', 'low']) {
    const middleValue = range[left][source as keyof Candlestick];

    const leftRange = range.slice(0, left);
    const rightRange = range.slice(-right);

    if (
      ['close', 'high'].includes(source) &&
      typeof leftRange.find(c => (c as any)[source] > middleValue) === 'undefined' &&
      typeof rightRange.find(c => (c as any)[source] >= middleValue) === 'undefined'
    ) {
      if (!result.high) {
        result.high = {};
      }

      result.high[source as 'close' | 'high'] = middleValue as number;
    }

    if (
      ['close', 'low'].includes(source) &&
      typeof leftRange.find(c => (c as any)[source] < middleValue) === 'undefined' &&
      typeof rightRange.find(c => (c as any)[source] <= middleValue) === 'undefined'
    ) {
      if (!result.low) {
        result.low = {};
      }

      result.low[source as 'close' | 'low'] = middleValue as number;
    }
  }

  return result;
}

/**
 * Export an object with all functions for backwards compatibility with JS imports
 */
export const ta = {
  getBollingerBandPercent,
  getPercentTrendStrength,
  candles2MarketData,
  getPredefinedIndicators,
  calculateReadyIndicators,
  createIndicatorsLookback,
  getTrendingDirection,
  getTrendingDirectionLastItem,
  getCrossedSince,
  getPivotPoints,
  getPivotPointsWithWicks
};
