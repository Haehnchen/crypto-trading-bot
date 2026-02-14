import percent from 'percent';

export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ZigzagResult {
  timePeriod: number;
  value: number;
  deviation: number;
  turningPoint: boolean;
}

export interface IndicatorOptions {
  [key: string]: any;
  length?: number;
  stddev?: number;
  fast_length?: number;
  slow_length?: number;
  signal_length?: number;
  rsi_length?: number;
  stoch_length?: number;
  k?: number;
  d?: number;
  step?: number;
  max?: number;
  source?: string;
  ranges?: number;
  deviation?: number;
  left?: number;
  right?: number;
}

export interface Indicator {
  key: string;
  indicator: string | Function;
  options?: IndicatorOptions;
}

export interface IndicatorResult {
  [key: string]: any;
}

// Source types for indicators
export type PriceSource = number[];
export type CandleSource = Candlestick[];
export type AnySource = PriceSource | CandleSource;

// Typed indicator function types
export type PriceIndicatorFn = (source: PriceSource, indicator: Indicator) => Promise<IndicatorResult>;
export type CandleIndicatorFn = (source: CandleSource, indicator: Indicator) => Promise<IndicatorResult>;
export type AnyIndicatorFn = (source: AnySource, indicator: Indicator) => Promise<IndicatorResult>;

// Talib result types
interface TalibResult {
  nbElement: number;
  begIndex: number;
  result: Record<string, Float64Array>;
}

interface TalibModule {
  execute: (params: Record<string, unknown>) => TalibResult;
}

// Lazy load modules
const getTalib = (): TalibModule => require('talib');
const getTechnicalIndicators = (): typeof import('technicalindicators') => require('technicalindicators');
const getTechnicalAnalysis = () => require('./technical_analysis');

/**
 * Execute talib synchronously (talib now supports sync calls)
 */
function talibExecute(request: Record<string, unknown>): TalibResult {
  return getTalib().execute(request);
}

/**
 * Talib input field types
 */
type TalibInputField = 'high' | 'low' | 'close' | 'open' | 'volume';

/**
 * Configuration for a talib indicator
 */
interface TalibIndicatorConfig {
  name: string;
  inputs?: TalibInputField[];
  optInputs?: Record<string, { talibKey: string; default?: number }>;
}

/**
 * Build talib request from candles or price array
 */
function buildTalibRequestFromCandles(
  candles: CandleSource,
  config: TalibIndicatorConfig,
  options: Record<string, unknown>
): Record<string, unknown> {
  const request: Record<string, unknown> = {
    name: config.name,
    startIdx: 0,
    endIdx: candles.length - 1
  };

  // Extract candle fields
  if (config.inputs) {
    for (const field of config.inputs) {
      request[field] = candles.map(c => c[field]);
    }
  }

  // Add optional parameters
  if (config.optInputs) {
    for (const [optKey, cfg] of Object.entries(config.optInputs)) {
      const value = options[optKey];
      request[cfg.talibKey] = value !== undefined ? value : cfg.default;
    }
  }

  return request;
}

/**
 * Build talib request from price array
 */
function buildTalibRequestFromPrices(
  prices: PriceSource,
  config: TalibIndicatorConfig,
  options: Record<string, unknown>
): Record<string, unknown> {
  const request: Record<string, unknown> = {
    name: config.name,
    startIdx: 0,
    endIdx: prices.length - 1,
    inReal: prices.slice()
  };

  // Add optional parameters
  if (config.optInputs) {
    for (const [optKey, cfg] of Object.entries(config.optInputs)) {
      const value = options[optKey];
      request[cfg.talibKey] = value !== undefined ? value : cfg.default;
    }
  }

  return request;
}

/**
 * Execute a simple talib indicator that returns a single array of values
 */
function executeSimpleTalib(
  prices: PriceSource,
  indicator: Indicator,
  config: TalibIndicatorConfig
): IndicatorResult {
  const { options = {} } = indicator;
  const result = talibExecute(buildTalibRequestFromPrices(prices, config, options));
  const outputKey = Object.keys(result.result)[0];
  return { [indicator.key]: Array.from(result.result[outputKey]) };
}

/**
 * Execute a candle-based talib indicator that returns a single array of values
 */
function executeCandleTalib(
  candles: CandleSource,
  indicator: Indicator,
  config: TalibIndicatorConfig
): IndicatorResult {
  const { options = {} } = indicator;
  const result = talibExecute(buildTalibRequestFromCandles(candles, config, options));
  const outputKey = Object.keys(result.result)[0];
  return { [indicator.key]: Array.from(result.result[outputKey]) };
}

/**
 * ZigZag indicator
 */
function zigzag(ticks: Candlestick[], deviation: number = 5, arraySize: number = -1): ZigzagResult[] {
  const turningPoints: any[] = [];
  let basePrice = -1;
  let lastDeviation = 0;
  deviation /= 100;

  const startingTick = arraySize === -1 ? 0 : ticks.length - arraySize;

  for (let i = startingTick; i < ticks.length; ++i) {
    const close = parseFloat(ticks[i].close.toString());
    const high = parseFloat(ticks[i].high.toString());
    const low = parseFloat(ticks[i].low.toString());
    let positiveDeviation = high / basePrice - 1;
    let negativeDeviation = low / basePrice - 1;

    if (basePrice === -1) {
      basePrice = close;
      lastDeviation = 0;
      turningPoints.push({ timePeriod: i, value: close, deviation: lastDeviation });
      continue;
    }

    if (positiveDeviation >= deviation || (positiveDeviation > 0 && lastDeviation > 0)) {
      if (lastDeviation > 0) {
        positiveDeviation += lastDeviation;
        turningPoints.pop();
      }
      turningPoints.push({ timePeriod: i, value: high, deviation: positiveDeviation });
      lastDeviation = positiveDeviation;
      basePrice = high;
    } else if (negativeDeviation <= -deviation || (negativeDeviation < 0 && lastDeviation < 0)) {
      if (lastDeviation < 0) {
        negativeDeviation += lastDeviation;
        turningPoints.pop();
      }
      turningPoints.push({ timePeriod: i, value: low, deviation: negativeDeviation });
      lastDeviation = negativeDeviation;
      basePrice = low;
    } else if (i === ticks.length - 1) {
      if (positiveDeviation > 0) turningPoints.push({ timePeriod: i, value: high, deviation: positiveDeviation });
      else turningPoints.push({ timePeriod: i, value: low, deviation: negativeDeviation });
    }
  }

  const zigzagResult: ZigzagResult[] = [];

  for (let i = 0; i < turningPoints.length; ++i) {
    const turningPoint = turningPoints[i];
    zigzagResult.push({
      timePeriod: turningPoint.timePeriod,
      value: turningPoint.value,
      deviation: parseFloat((turningPoint.deviation * 100).toFixed(2)),
      turningPoint: turningPoint.deviation > deviation || turningPoint.deviation < -deviation
    });

    if (turningPoint.timePeriod >= ticks.length - 1) continue;

    const nextTurningPoint = turningPoints[i + 1];
    for (let j = turningPoint.timePeriod + 1; j < nextTurningPoint.timePeriod; ++j) {
      const distanceToTP = j - turningPoint.timePeriod;
      const distanceTPs = nextTurningPoint.timePeriod - turningPoint.timePeriod;
      const value = turningPoint.value + ((nextTurningPoint.value - turningPoint.value) / distanceTPs) * distanceToTP;
      const currentDeviation = value / turningPoint.value;

      zigzagResult.push({
        timePeriod: j,
        value: value,
        deviation: parseFloat((currentDeviation * 100).toFixed(2)),
        turningPoint: false
      });
    }
  }

  return zigzagResult;
}

/**
 * Simple SMA helper for custom indicators
 */
function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += data[j];
    }
    result.push(sum / period);
  }
  return result;
}

/**
 * Simple WMA helper for custom indicators (HMA)
 */
function calculateWMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    let weightSum = 0;
    for (let j = 0; j < period; j++) {
      const weight = j + 1;
      sum += data[i - period + 1 + j] * weight;
      weightSum += weight;
    }
    result.push(sum / weightSum);
  }
  return result;
}

/**
 * Indicators that require full candle data (not just close prices)
 */
export const sourceCandle = [
  'cci',
  'pivot_points_high_low',
  'obv',
  'ao',
  'mfi',
  'stoch',
  'vwma',
  'atr',
  'adx',
  'volume_profile',
  'volume_by_price',
  'ichimoku_cloud',
  'zigzag',
  'wicked',
  'heikin_ashi',
  'psar',
  'hma',
  'candles'
] as const;

export const indicators = {
  // Bollinger Bands - requires price array
  bb: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const stddev = (options.stddev as number) || 2;
    const length = (options.length as number) || 20;

    const result = talibExecute({
      name: 'BBANDS',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: source.slice(),
      optInTimePeriod: length,
      optInNbDevUp: stddev,
      optInNbDevDn: stddev,
      optInMAType: 0
    });

    const finalResult: Array<{ upper: number; middle: number; lower: number; width: number }> = [];
    for (let i = 0; i < result.nbElement; i++) {
      finalResult.push({
        upper: result.result.outRealUpperBand[i],
        middle: result.result.outRealMiddleBand[i],
        lower: result.result.outRealLowerBand[i],
        width: (result.result.outRealUpperBand[i] - result.result.outRealLowerBand[i]) / result.result.outRealMiddleBand[i]
      });
    }
    return { [indicator.key]: finalResult };
  },

  // On Balance Volume - requires candles
  obv: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const result = talibExecute({
      name: 'OBV',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: source.map(c => c.close),
      volume: source.map(c => c.volume)
    });

    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Awesome Oscillator - requires candles
  ao: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const medianPrices = source.map(c => (c.high + c.low) / 2);
    const sma5 = calculateSMA(medianPrices, 5);
    const sma34 = calculateSMA(medianPrices, 34);

    const result: number[] = [];
    const offset = 33;
    for (let i = 0; i < sma5.length - (offset - 4); i++) {
      result.push(sma5[i + (offset - 4)] - sma34[i]);
    }

    return { [indicator.key]: result };
  },

  // Weighted Moving Average - requires price array
  wma: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'WMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    });
  },

  // Double EMA - requires price array
  dema: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'DEMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    });
  },

  // Triple EMA - requires price array
  tema: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'TEMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    });
  },

  // Triangular MA - requires price array
  trima: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'TRIMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    });
  },

  // Kaufman Adaptive MA - requires price array
  kama: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'KAMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    });
  },

  // Rate of Change - requires price array
  roc: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'ROC',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    });
  },

  // Average True Range - requires candles
  atr: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeCandleTalib(source, indicator, {
      name: 'ATR',
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    });
  },

  // Money Flow Index - requires candles
  mfi: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeCandleTalib(source, indicator, {
      name: 'MFI',
      inputs: ['high', 'low', 'close', 'volume'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    });
  },

  // Simple Moving Average - requires price array
  sma: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'SMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    });
  },

  // Exponential Moving Average - requires price array
  ema: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'EMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    });
  },

  // Relative Strength Index - requires price array
  rsi: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeSimpleTalib(source, indicator, {
      name: 'RSI',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    });
  },

  // Hull Moving Average - can take candles or price array
  hma: async (source: AnySource, indicator: Indicator): Promise<IndicatorResult> => {
    const period = (indicator?.options?.length as number) || 9;
    const candleSource = (indicator.options?.source as string) || 'close';

    const data: number[] = typeof source[0] === 'object'
      ? (source as CandleSource).map(c => c[candleSource as keyof Candlestick] as number)
      : (source as PriceSource).slice();

    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    const wmaHalf = calculateWMA(data, halfPeriod);
    const wmaFull = calculateWMA(data, period);

    const offset = period - halfPeriod;
    const rawData: number[] = [];
    for (let i = 0; i < wmaFull.length; i++) {
      rawData.push(2 * wmaHalf[i + offset] - wmaFull[i]);
    }

    return { [indicator.key]: calculateWMA(rawData, sqrtPeriod) };
  },

  // Commodity Channel Index - requires candles
  cci: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeCandleTalib(source, indicator, {
      name: 'CCI',
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 20 } }
    });
  },

  // Volume Weighted MA - requires candles
  vwma: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const period = (indicator?.options?.length as number) || 20;

    const result: number[] = [];
    for (let i = period - 1; i < source.length; i++) {
      let sumPV = 0;
      let sumV = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumPV += source[j].close * source[j].volume;
        sumV += source[j].volume;
      }
      result.push(sumV > 0 ? sumPV / sumV : 0);
    }

    return { [indicator.key]: result };
  },

  // Stochastic Oscillator - requires candles
  stoch: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const k = (options.k as number) || 3;
    const d = (options.d as number) || 3;
    const length = (options.length as number) || 14;

    const result = talibExecute({
      name: 'STOCH',
      startIdx: 0,
      endIdx: source.length - 1,
      high: source.map(c => c.high),
      low: source.map(c => c.low),
      close: source.map(c => c.close),
      optInFastK_Period: length,
      optInSlowK_Period: k,
      optInSlowK_MAType: 0,
      optInSlowD_Period: d,
      optInSlowD_MAType: 0
    });

    const finalResult: Array<{ stoch_k: number; stoch_d: number }> = [];
    for (let i = 0; i < result.nbElement; i++) {
      finalResult.push({
        stoch_k: result.result.outSlowK[i],
        stoch_d: result.result.outSlowD[i]
      });
    }
    return { [indicator.key]: finalResult };
  },

  // MACD - requires price array
  macd: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const result = talibExecute({
      name: 'MACD',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: source.slice(),
      optInFastPeriod: (options.fast_length as number) || 12,
      optInSlowPeriod: (options.slow_length as number) || 26,
      optInSignalPeriod: (options.signal_length as number) || 9
    });

    const finalResult: Array<{ macd: number; signal: number; histogram: number }> = [];
    for (let i = 0; i < result.nbElement; i++) {
      finalResult.push({
        macd: result.result.outMACD[i],
        signal: result.result.outMACDSignal[i],
        histogram: result.result.outMACDHist[i]
      });
    }
    return { [indicator.key]: finalResult };
  },

  // Average Directional Index - requires candles
  adx: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    return executeCandleTalib(source, indicator, {
      name: 'ADX',
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    });
  },

  // Extended MACD with different MA types - requires price array
  macd_ext: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    const getMaTypeFromString = (maType: string): number => {
      const types = ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'MAMA', 'T3'];
      return types.includes(maType) ? types.indexOf(maType) : 1;
    };

    const { options = {} } = indicator;
    const defaultMaType = (options.default_ma_type as string) || 'EMA';

    const result = talibExecute({
      name: 'MACDEXT',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: source.slice(),
      optInFastPeriod: (options.fast_period as number) || 12,
      optInSlowPeriod: (options.slow_period as number) || 26,
      optInSignalPeriod: (options.signal_period as number) || 9,
      optInFastMAType: getMaTypeFromString((options.fast_ma_type as string) || defaultMaType),
      optInSlowMAType: getMaTypeFromString((options.slow_ma_type as string) || defaultMaType),
      optInSignalMAType: getMaTypeFromString((options.signal_ma_type as string) || defaultMaType)
    });

    const resultHistory: Array<{ macd: number; histogram: number; signal: number }> = [];
    for (let i = 0; i < result.nbElement; i++) {
      resultHistory.push({
        macd: result.result.outMACD[i],
        histogram: result.result.outMACDHist[i],
        signal: result.result.outMACDSignal[i]
      });
    }
    return { [indicator.key]: resultHistory };
  },

  // Bollinger Bands using talib - requires price array
  bb_talib: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const length = (options.length as number) || 20;
    const stddev = (options.stddev as number) || 2;

    const result = talibExecute({
      name: 'BBANDS',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: source.slice(),
      optInTimePeriod: length,
      optInNbDevUp: stddev,
      optInNbDevDn: stddev,
      optInMAType: 0
    });

    const resultHistory: Array<{ upper: number; middle: number; lower: number; width: number }> = [];
    for (let i = 0; i < result.nbElement; i++) {
      resultHistory.push({
        upper: result.result.outRealUpperBand[i],
        middle: result.result.outRealMiddleBand[i],
        lower: result.result.outRealLowerBand[i],
        width: (result.result.outRealUpperBand[i] - result.result.outRealLowerBand[i]) / result.result.outRealMiddleBand[i]
      });
    }
    return { [indicator.key]: resultHistory };
  },

  // Stochastic RSI - requires price array
  stoch_rsi: async (source: PriceSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const rsi_length = (options.rsi_length as number) || 14;
    const stoch_length = (options.stoch_length as number) || 14;
    const k = (options.k as number) || 3;
    const d = (options.d as number) || 3;

    const { StochasticRSI } = getTechnicalIndicators();
    const f = new StochasticRSI({
      values: source,
      rsiPeriod: rsi_length,
      stochasticPeriod: stoch_length,
      kPeriod: k,
      dPeriod: d
    });

    const results = f.getResult();
    return {
      [indicator.key]: results.map((r: { k: number; d: number }) => ({
        stoch_k: r.k,
        stoch_d: r.d
      }))
    };
  },

  // Parabolic SAR - requires candles
  psar: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const step = (options.step as number) || 0.02;
    const max = (options.max as number) || 0.2;

    const { PSAR } = getTechnicalIndicators();
    return {
      [indicator.key]: new PSAR({
        high: source.map(c => c.high),
        low: source.map(c => c.low),
        step,
        max
      }).getResult()
    };
  },

  // Heikin Ashi - requires candles
  heikin_ashi: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { HeikinAshi } = getTechnicalIndicators();

    const results = new HeikinAshi({
      close: source.map(c => c.close),
      high: source.map(c => c.high),
      low: source.map(c => c.low),
      open: source.map(c => c.open),
      timestamp: source.map(c => c.time),
      volume: source.map(c => c.volume)
    }).getResult();

    const candles: Candlestick[] = [];
    const length = results.open?.length || 0;
    for (let i = 0; i < length; i++) {
      candles.push({
        close: results.close[i],
        high: results.high[i],
        low: results.low[i],
        open: results.open[i],
        time: results.timestamp[i],
        volume: results.volume[i]
      });
    }

    return { [indicator.key]: candles };
  },

  // Volume Profile - requires candles
  volume_profile: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const length = (options.length as number) || 200;
    const ranges = (options.ranges as number) || 14;

    const { candles2MarketData } = getTechnicalAnalysis();
    const { VolumeProfile } = getTechnicalIndicators();

    return {
      [indicator.key]: new VolumeProfile({
        ...candles2MarketData(source, length),
        noOfBars: ranges
      }).getResult()
    };
  },

  // Volume by Price - requires candles
  volume_by_price: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const length = (options.length as number) || 200;
    const ranges = (options.ranges as number) || 12;

    const lookbackRange = source.slice(-length);

    const minMax = lookbackRange.reduce(
      (acc, c) => [Math.min(c.close, acc[0]), Math.max(c.close, acc[1])],
      [Number.MAX_VALUE, Number.MIN_VALUE]
    );

    const rangeSize = (minMax[1] - minMax[0]) / ranges;
    const rangeBlocks: Array<{ low: number; high: number; volume: number }> = [];

    let current = minMax[0];
    for (let i = 0; i < ranges; i++) {
      const volumes = lookbackRange
        .filter(c => c.close >= current && c.close < current + rangeSize)
        .map(c => c.volume);

      rangeBlocks.push({
        low: i === 0 ? current * 0.9999 : current,
        high: i === ranges - 1 ? minMax[1] * 1.0001 : current + rangeSize,
        volume: volumes.length > 0 ? volumes.reduce((x, y) => x + y, 0) : 0
      });

      current += rangeSize;
    }

    return { [indicator.key]: [rangeBlocks.reverse()] };
  },

  // ZigZag - requires candles
  zigzag: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const length = (options.length as number) || 1000;
    const deviation = (options.deviation as number) || 5;

    const result = zigzag(source.slice(-length), deviation);
    return { [indicator.key]: result.map(r => r.turningPoint ? r : {}) };
  },

  // Ichimoku Cloud - requires candles
  ichimoku_cloud: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { options = {} } = indicator;
    const conversionPeriod = (options.conversionPeriod as number) || 9;
    const basePeriod = (options.basePeriod as number) || 26;
    const spanPeriod = (options.spanPeriod as number) || 52;
    const displacement = (options.displacement as number) || 26;

    const { candles2MarketData } = getTechnicalAnalysis();
    const { IchimokuCloud } = getTechnicalIndicators();

    return {
      [indicator.key]: new IchimokuCloud({
        ...candles2MarketData(source, undefined, ['high', 'low']),
        conversionPeriod,
        basePeriod,
        spanPeriod,
        displacement
      }).getResult()
    };
  },

  // Pivot Points High/Low - requires candles
  pivot_points_high_low: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { key, options = {} } = indicator;
    const left = (options.left as number) || 5;
    const right = (options.right as number) || 5;

    const { getPivotPointsWithWicks } = getTechnicalAnalysis();
    const result: any[] = [];

    for (let i = 0; i < source.length; i++) {
      const start = i - left - right;
      result.push(start < 0 ? {} : getPivotPointsWithWicks(source.slice(start, i + 1), left, right));
    }

    return { [key]: result };
  },

  // Wicked (candle wick analysis) - requires candles
  wicked: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => {
    const { key } = indicator;

    const results: Array<{ top: number; body: number; bottom: number }> = [];
    for (const c of source) {
      const range = c.high - c.low;
      results.push({
        top: Math.abs(percent.calc(c.high - Math.max(c.close, c.open), range, 2)),
        body: Math.abs(percent.calc(c.close - c.open, range, 2)),
        bottom: Math.abs(percent.calc(c.low - Math.min(c.close, c.open), range, 2))
      });
    }

    return { [key]: results.reverse() };
  },

  // Candles (pass-through) - requires candles
  candles: async (source: CandleSource, indicator: Indicator): Promise<IndicatorResult> => ({
    [indicator.key]: source.slice()
  })
};

export default indicators;
