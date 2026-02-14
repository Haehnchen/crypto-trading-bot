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

export type IndicatorFunction = (source: any[], indicator: Indicator) => Promise<IndicatorResult>;

export interface IndicatorsCollection {
  bb: IndicatorFunction;
  obv: IndicatorFunction;
  ao: IndicatorFunction;
  wma: IndicatorFunction;
  dema: IndicatorFunction;
  tema: IndicatorFunction;
  trima: IndicatorFunction;
  kama: IndicatorFunction;
  roc: IndicatorFunction;
  atr: IndicatorFunction;
  mfi: IndicatorFunction;
  sma: IndicatorFunction;
  ema: IndicatorFunction;
  rsi: IndicatorFunction;
  hma: IndicatorFunction;
  cci: IndicatorFunction;
  vwma: IndicatorFunction;
  stoch: IndicatorFunction;
  macd: IndicatorFunction;
  adx: IndicatorFunction;
  macd_ext: IndicatorFunction;
  bb_talib: IndicatorFunction;
  stoch_rsi: IndicatorFunction;
  psar: IndicatorFunction;
  heikin_ashi: IndicatorFunction;
  volume_profile: IndicatorFunction;
  volume_by_price: IndicatorFunction;
  zigzag: IndicatorFunction;
  ichimoku_cloud: IndicatorFunction;
  pivot_points_high_low: IndicatorFunction;
  wicked: IndicatorFunction;
  candles: IndicatorFunction;
}

// Lazy load modules
const getTalib = () => require('talib') as { execute: (params: any, callback: (err: any, result: any) => void) => void };
const getTechnicalIndicators = () => require('technicalindicators');
const getTechnicalAnalysis = () => require('./technical_analysis');

/**
 * Promisified talib.execute
 */
async function talibExecute(request: any): Promise<any> {
  return new Promise((resolve, reject) => {
    getTalib().execute(request, (err: any, result: any) => {
      if (err) {
        resolve(null); // Return null instead of rejecting to match original behavior
        return;
      }
      resolve(result);
    });
  });
}

/**
 * ZigZag indicator
 */
function zigzag(ticks: Candlestick[], deviation: number = 5, arraySize: number = -1): ZigzagResult[] {
  const turningPoints: any[] = [];
  let basePrice = -1;
  let lastDeviation = 0;
  deviation /= 100;

  const startingTick = arraySize == -1 ? 0 : ticks.length - arraySize;

  for (let i = startingTick; i < ticks.length; ++i) {
    const close = parseFloat(ticks[i].close.toString());
    const high = parseFloat(ticks[i].high.toString());
    const low = parseFloat(ticks[i].low.toString());
    let positiveDeviation = high / basePrice - 1;
    let negativeDeviation = low / basePrice - 1;

    if (basePrice == -1) {
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
    }
    else if (negativeDeviation <= -deviation || (negativeDeviation < 0 && lastDeviation < 0)) {
      if (lastDeviation < 0) {
        negativeDeviation += lastDeviation;
        turningPoints.pop();
      }

      turningPoints.push({ timePeriod: i, value: low, deviation: negativeDeviation });
      lastDeviation = negativeDeviation;
      basePrice = low;
    }
    else if (i === ticks.length - 1) {
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
 * Build talib request from config
 */
function buildTalibRequest(
  source: any[],
  name: string,
  options: Record<string, any>,
  config: {
    inputs?: ('high' | 'low' | 'close' | 'volume' | 'open')[];
    optInputs?: Record<string, { talibKey: string; default?: any }>;
  }
): any {
  const request: any = {
    name,
    startIdx: 0,
    endIdx: source.length - 1
  };

  // Handle inputs
  if (config.inputs && source.length > 0 && typeof source[0] === 'object') {
    if (config.inputs.includes('high')) request.high = source.map((c: any) => c.high);
    if (config.inputs.includes('low')) request.low = source.map((c: any) => c.low);
    if (config.inputs.includes('close')) request.close = source.map((c: any) => c.close);
    if (config.inputs.includes('open')) request.open = source.map((c: any) => c.open);
    if (config.inputs.includes('volume')) request.volume = source.map((c: any) => c.volume);
  } else {
    request.inReal = source.slice();
  }

  // Add optional parameters
  if (config.optInputs) {
    for (const [optKey, cfg] of Object.entries(config.optInputs)) {
      if (options[optKey] !== undefined) {
        request[cfg.talibKey] = options[optKey];
      } else if (cfg.default !== undefined) {
        request[cfg.talibKey] = cfg.default;
      }
    }
  }

  return request;
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
];

export const indicators: IndicatorsCollection = {
  // Bollinger Bands
  bb: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const stddev = options.stddev || 2;
    const length = options.length || 20;

    const result = await talibExecute({
      name: 'BBANDS',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: source.slice(),
      optInTimePeriod: length,
      optInNbDevUp: stddev,
      optInNbDevDn: stddev,
      optInMAType: 0
    });

    if (!result) return { [indicator.key]: [] };

    const finalResult: any[] = [];
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

  // On Balance Volume
  obv: async (source: any[], indicator: Indicator) => {
    const closes = source.map((c: any) => c.close);
    const volumes = source.map((c: any) => c.volume);

    const result = await talibExecute({
      name: 'OBV',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: closes,
      volume: volumes
    });

    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Awesome Oscillator
  ao: async (source: any[], indicator: Indicator) => {
    const highs = source.map((c: any) => c.high);
    const lows = source.map((c: any) => c.low);
    const medianPrices = highs.map((h: number, i: number) => (h + lows[i]) / 2);

    const sma5 = calculateSMA(medianPrices, 5);
    const sma34 = calculateSMA(medianPrices, 34);

    const result: number[] = [];
    const offset = 33;
    for (let i = 0; i < sma5.length - (offset - 4); i++) {
      result.push(sma5[i + (offset - 4)] - sma34[i]);
    }

    return { [indicator.key]: result };
  },

  // Weighted Moving Average
  wma: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'WMA', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Double EMA
  dema: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'DEMA', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Triple EMA
  tema: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'TEMA', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Triangular MA
  trima: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'TRIMA', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Kaufman Adaptive MA
  kama: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'KAMA', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Rate of Change
  roc: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'ROC', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Average True Range
  atr: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'ATR', options, {
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Money Flow Index
  mfi: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'MFI', options, {
      inputs: ['high', 'low', 'close', 'volume'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Simple Moving Average
  sma: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'SMA', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Exponential Moving Average
  ema: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'EMA', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Relative Strength Index
  rsi: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'RSI', options, {
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Hull Moving Average - custom implementation
  hma: async (source: any[], indicator: Indicator) => {
    const period = indicator?.options?.length || 9;
    const candleSource = (indicator.options && indicator.options.source) || 'close';

    let data: number[];
    if (typeof source[0] === 'object') {
      data = source.map((c: any) => c[candleSource]);
    } else {
      data = source.slice();
    }

    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    const wmaHalf = calculateWMA(data, halfPeriod);
    const wmaFull = calculateWMA(data, period);

    const offset = period - halfPeriod;
    const rawData: number[] = [];
    for (let i = 0; i < wmaFull.length; i++) {
      rawData.push(2 * wmaHalf[i + offset] - wmaFull[i]);
    }

    const hma = calculateWMA(rawData, sqrtPeriod);
    return { [indicator.key]: hma };
  },

  // Commodity Channel Index
  cci: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'CCI', options, {
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 20 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Volume Weighted MA
  vwma: async (source: any[], indicator: Indicator) => {
    const period = indicator?.options?.length || 20;
    const closes = source.map((c: any) => c.close);
    const volumes = source.map((c: any) => c.volume);

    const result: number[] = [];
    for (let i = period - 1; i < source.length; i++) {
      let sumPV = 0;
      let sumV = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sumPV += closes[j] * volumes[j];
        sumV += volumes[j];
      }
      result.push(sumV > 0 ? sumPV / sumV : 0);
    }

    return { [indicator.key]: result };
  },

  // Stochastic Oscillator
  stoch: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const k = options.k || 3;
    const d = options.d || 3;
    const length = options.length || 14;

    const result = await talibExecute({
      name: 'STOCH',
      startIdx: 0,
      endIdx: source.length - 1,
      high: source.map((c: any) => c.high),
      low: source.map((c: any) => c.low),
      close: source.map((c: any) => c.close),
      optInFastK_Period: length,
      optInSlowK_Period: k,
      optInSlowK_MAType: 0,
      optInSlowD_Period: d,
      optInSlowD_MAType: 0
    });

    if (!result) return { [indicator.key]: [] };

    const finalResult: any[] = [];
    for (let i = 0; i < result.nbElement; i++) {
      finalResult.push({
        stoch_k: result.result.outSlowK[i],
        stoch_d: result.result.outSlowD[i]
      });
    }
    return { [indicator.key]: finalResult };
  },

  // MACD
  macd: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'MACD', options, {
      optInputs: {
        fast_length: { talibKey: 'optInFastPeriod', default: 12 },
        slow_length: { talibKey: 'optInSlowPeriod', default: 26 },
        signal_length: { talibKey: 'optInSignalPeriod', default: 9 }
      }
    }));

    if (!result) return { [indicator.key]: [] };

    const finalResult: any[] = [];
    for (let i = 0; i < result.nbElement; i++) {
      finalResult.push({
        macd: result.result.outMACD[i],
        signal: result.result.outMACDSignal[i],
        histogram: result.result.outMACDHist[i]
      });
    }
    return { [indicator.key]: finalResult };
  },

  // Average Directional Index
  adx: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const result = await talibExecute(buildTalibRequest(source, 'ADX', options, {
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } }
    }));
    if (!result) return { [indicator.key]: [] };
    return { [indicator.key]: Array.from(result.result.outReal) };
  },

  // Extended MACD with different MA types
  macd_ext: async (source: any[], indicator: Indicator) => {
    const getMaTypeFromString = (maType: string): number => {
      const types = ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'MAMA', 'T3'];
      return types.includes(maType) ? types.indexOf(maType) : 1;
    };

    const { options = {} } = indicator;
    const defaultMaType = options.default_ma_type || 'EMA';

    const result = await talibExecute({
      name: 'MACDEXT',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: source.slice(),
      optInFastPeriod: options.fast_period || 12,
      optInSlowPeriod: options.slow_period || 26,
      optInSignalPeriod: options.signal_period || 9,
      optInFastMAType: getMaTypeFromString(options.fast_ma_type || defaultMaType),
      optInSlowMAType: getMaTypeFromString(options.slow_ma_type || defaultMaType),
      optInSignalMAType: getMaTypeFromString(options.signal_ma_type || defaultMaType)
    });

    if (!result) return { [indicator.key]: [] };

    const resultHistory: any[] = [];
    for (let i = 0; i < result.nbElement; i++) {
      resultHistory.push({
        macd: result.result.outMACD[i],
        histogram: result.result.outMACDHist[i],
        signal: result.result.outMACDSignal[i]
      });
    }
    return { [indicator.key]: resultHistory };
  },

  // Bollinger Bands using talib (duplicate of bb for backwards compatibility)
  bb_talib: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const length = options.length || 20;
    const stddev = options.stddev || 2;

    const result = await talibExecute({
      name: 'BBANDS',
      startIdx: 0,
      endIdx: source.length - 1,
      inReal: source.slice(),
      optInTimePeriod: length,
      optInNbDevUp: stddev,
      optInNbDevDn: stddev,
      optInMAType: 0
    });

    if (!result) return { [indicator.key]: [] };

    const resultHistory: any[] = [];
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

  // Stochastic RSI
  stoch_rsi: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const { rsi_length = 14, stoch_length = 14, k = 3, d = 3 } = options;

    const { StochasticRSI } = getTechnicalIndicators();
    const f = new StochasticRSI({
      values: source,
      rsiPeriod: rsi_length,
      stochasticPeriod: stoch_length,
      kPeriod: k,
      dPeriod: d
    });

    const results = f.getResult();
    const result: any[] = results.map((r: any) => ({
      stoch_k: r.k,
      stoch_d: r.d
    }));

    return { [indicator.key]: result };
  },

  // Parabolic SAR
  psar: async (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const { step = 0.02, max = 0.2 } = options;

    const { PSAR } = getTechnicalIndicators();
    const input = {
      high: source.map((c: any) => c.high),
      low: source.map((c: any) => c.low),
      step,
      max
    };

    return { [indicator.key]: new PSAR(input).getResult() };
  },

  // Heikin Ashi
  heikin_ashi: async (source: Candlestick[], indicator: Indicator) => {
    const { HeikinAshi } = getTechnicalIndicators();

    const input = {
      close: source.map(c => c.close),
      high: source.map(c => c.high),
      low: source.map(c => c.low),
      open: source.map(c => c.open),
      timestamp: source.map(c => c.time),
      volume: source.map(c => c.volume)
    };

    const results = new HeikinAshi(input).getResult();
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

  // Volume Profile
  volume_profile: async (source: Candlestick[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const { length = 200, ranges = 14 } = options;

    const { candles2MarketData } = getTechnicalAnalysis();
    const { VolumeProfile } = getTechnicalIndicators();

    const f = new VolumeProfile({
      ...candles2MarketData(source, length),
      noOfBars: ranges
    });

    return { [indicator.key]: f.getResult() };
  },

  // Volume by Price
  volume_by_price: async (source: Candlestick[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const { length = 200, ranges = 12 } = options;

    const lookbackRange = source.slice(-length);

    const minMax = lookbackRange.reduce(
      (accumulator, currentValue) => [
        Math.min(currentValue.close, accumulator[0]),
        Math.max(currentValue.close, accumulator[1])
      ],
      [Number.MAX_VALUE, Number.MIN_VALUE]
    );

    const rangeSize = (minMax[1] - minMax[0]) / ranges;
    const rangeBlocks: any[] = [];

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

  // ZigZag
  zigzag: async (source: Candlestick[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const { length = 1000, deviation = 5 } = options;

    const result = zigzag(source.slice(-length), deviation);
    const turningPoints = result.map(r => (r && r.turningPoint === true ? r : {}));

    return { [indicator.key]: turningPoints };
  },

  // Ichimoku Cloud
  ichimoku_cloud: async (source: Candlestick[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const { conversionPeriod = 9, basePeriod = 26, spanPeriod = 52, displacement = 26 } = options;

    const { candles2MarketData } = getTechnicalAnalysis();
    const { IchimokuCloud } = getTechnicalIndicators();

    const f = new IchimokuCloud({
      ...candles2MarketData(source, undefined, ['high', 'low']),
      conversionPeriod,
      basePeriod,
      spanPeriod,
      displacement
    });

    return { [indicator.key]: f.getResult() };
  },

  // Pivot Points High/Low
  pivot_points_high_low: async (source: Candlestick[], indicator: Indicator) => {
    const { key, options = {} } = indicator;
    const { left = 5, right = 5 } = options;

    const { getPivotPointsWithWicks } = getTechnicalAnalysis();
    const result: any[] = [];

    for (let i = 0; i < source.length; i++) {
      const start = i - left - right;
      if (start < 0) {
        result.push({});
        continue;
      }
      result.push(getPivotPointsWithWicks(source.slice(start, i + 1), left, right));
    }

    return { [key]: result };
  },

  // Wicked (candle wick analysis)
  wicked: async (source: Candlestick[], indicator: Indicator) => {
    const { key } = indicator;

    const { candles2MarketData } = getTechnicalAnalysis();
    const marketData = candles2MarketData(source, undefined, ['high', 'close', 'open', 'low']);

    const results: any[] = [];
    for (let i = 0; i < marketData.close.length; i++) {
      const top = marketData.high[i] - Math.max(marketData.close[i], marketData.open[i]);
      const bottom = marketData.low[i] - Math.min(marketData.close[i], marketData.open[i]);

      results.push({
        top: Math.abs(percent.calc(top, marketData.high[i] - marketData.low[i], 2)),
        body: Math.abs(percent.calc(marketData.close[i] - marketData.open[i], marketData.high[i] - marketData.low[i], 2)),
        bottom: Math.abs(percent.calc(bottom, marketData.high[i] - marketData.low[i], 2))
      });
    }

    return { [key]: results.reverse() };
  },

  // Candles (pass-through)
  candles: async (source: any[], indicator: Indicator) => ({
    [indicator.key]: source.slice()
  })
};

export default indicators;
