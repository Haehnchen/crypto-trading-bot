const talib = require('talib');
const percent = require('percent');

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
 * Helper to execute talib indicators with a simpler API
 * @param closePrices - Array of close prices (or any single input)
 * @param candles - Array of candle objects (for HLC/HLCV indicators)
 * @param indicator - Indicator configuration
 * @param talibConfig - talib configuration (name, inputs, outputs mapping)
 */
interface TalibConfig {
  name: string;
  inputs?: ('high' | 'low' | 'close' | 'volume' | 'open')[];  // Which candle fields to use
  optInputs?: Record<string, { talibKey: string; default?: any }>;  // Map indicator.options to talib parameter names with optional defaults
  outputs?: { talib: string; result: string }[];  // Map talib output names to result names
  transform?: (results: any[]) => any[];  // Optional transform for result format
  padToInputLength?: boolean;  // Pad results with undefined to match input length
}

function executeTalibIndicator(
  source: any[],
  indicator: Indicator,
  talibConfig: TalibConfig
): Promise<IndicatorResult> {
  return new Promise(resolve => {
    const { options = {} } = indicator;

    // Build talib request
    const request: any = {
      name: talibConfig.name,
      startIdx: 0,
      endIdx: source.length - 1
    };

    // Handle inputs - if source contains candle objects, extract fields
    if (talibConfig.inputs && source.length > 0 && typeof source[0] === 'object') {
      if (talibConfig.inputs.includes('high')) request.high = source.map((c: any) => c.high);
      if (talibConfig.inputs.includes('low')) request.low = source.map((c: any) => c.low);
      if (talibConfig.inputs.includes('close')) request.close = source.map((c: any) => c.close);
      if (talibConfig.inputs.includes('open')) request.open = source.map((c: any) => c.open);
      if (talibConfig.inputs.includes('volume')) request.volume = source.map((c: any) => c.volume);
    } else {
      // Single input (close prices)
      request.inReal = source.slice();
    }

    // Add optional parameters - only add if the option is provided or has a default
    if (talibConfig.optInputs) {
      for (const [optKey, config] of Object.entries(talibConfig.optInputs)) {
        const talibKey = typeof config === 'string' ? config : config.talibKey;
        const defaultValue = typeof config === 'object' ? config.default : undefined;

        if (options[optKey] !== undefined) {
          request[talibKey] = options[optKey];
        } else if (defaultValue !== undefined) {
          request[talibKey] = defaultValue;
        }
      }
    }

    talib.execute(request, (err: any, result: any) => {
      if (err || !result) {
        resolve({ [indicator.key]: [] });
        return;
      }

      let finalResult: any[];

      if (talibConfig.outputs && talibConfig.outputs.length > 1) {
        // Multiple outputs - create objects with named properties
        finalResult = [];
        for (let i = 0; i < result.nbElement; i++) {
          const obj: any = {};
          for (const output of talibConfig.outputs!) {
            obj[output.result] = result.result[output.talib][i];
          }
          if (talibConfig.transform) {
            finalResult.push(talibConfig.transform([obj])[0]);
          } else {
            finalResult.push(obj);
          }
        }
      } else {
        // Single output - just return array of values
        const outputKey = talibConfig.outputs?.[0]?.talib || Object.keys(result.result)[0];
        finalResult = Array.from(result.result[outputKey] || []);
      }

      // Pad results to match input length if requested (for backwards compatibility with tulind)
      if (talibConfig.padToInputLength && result.begIndex > 0) {
        const padding = new Array(result.begIndex).fill(undefined);
        finalResult = [...padding, ...finalResult];
      }

      resolve({ [indicator.key]: finalResult });
    });
  });
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
  // Bollinger Bands - using talib
  bb: (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const stddev = options.stddev || 2;
    const length = options.length || 20;

    return new Promise(resolve => {
      talib.execute({
        name: 'BBANDS',
        startIdx: 0,
        endIdx: source.length - 1,
        inReal: source.slice(),
        optInTimePeriod: length,
        optInNbDevUp: stddev,
        optInNbDevDn: stddev,
        optInMAType: 0
      }, (err: any, result: any) => {
        if (err || !result) {
          resolve({ [indicator.key]: [] });
          return;
        }

        const finalResult: any[] = [];
        for (let i = 0; i < result.nbElement; i++) {
          finalResult.push({
            upper: result.result.outRealUpperBand[i],
            middle: result.result.outRealMiddleBand[i],
            lower: result.result.outRealLowerBand[i],
            width: (result.result.outRealUpperBand[i] - result.result.outRealLowerBand[i]) / result.result.outRealMiddleBand[i]
          });
        }
        resolve({ [indicator.key]: finalResult });
      });
    });
  },

  // On Balance Volume - using talib
  obv: (source: any[], indicator: Indicator) => {
    return new Promise(resolve => {
      const closes = source.map((c: any) => c.close);
      const volumes = source.map((c: any) => c.volume);

      talib.execute({
        name: 'OBV',
        startIdx: 0,
        endIdx: source.length - 1,
        inReal: closes,
        volume: volumes
      }, (err: any, result: any) => {
        if (err || !result) {
          resolve({ [indicator.key]: [] });
          return;
        }
        resolve({ [indicator.key]: Array.from(result.result.outReal) });
      });
    });
  },

  // Awesome Oscillator - custom implementation (tulind: high, low -> ao)
  ao: (source: any[], indicator: Indicator) => {
    return new Promise(resolve => {
      const highs = source.map((c: any) => c.high);
      const lows = source.map((c: any) => c.low);
      const medianPrices = highs.map((h: number, i: number) => (h + lows[i]) / 2);

      // AO = SMA(median, 5) - SMA(median, 34)
      const sma5 = calculateSMA(medianPrices, 5);
      const sma34 = calculateSMA(medianPrices, 34);

      const result: number[] = [];
      const offset = 33; // Start from where both SMAs have values
      for (let i = 0; i < sma5.length - (offset - 4); i++) {
        result.push(sma5[i + (offset - 4)] - sma34[i]);
      }

      resolve({ [indicator.key]: result });
    });
  },

  // Weighted Moving Average - using talib
  wma: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'WMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } },
      outputs: [{ talib: 'outReal', result: 'wma' }]
    });
  },

  // Double EMA - using talib
  dema: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'DEMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } },
      outputs: [{ talib: 'outReal', result: 'dema' }]
    });
  },

  // Triple EMA - using talib
  tema: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'TEMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } },
      outputs: [{ talib: 'outReal', result: 'tema' }]
    });
  },

  // Triangular MA - using talib
  trima: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'TRIMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } },
      outputs: [{ talib: 'outReal', result: 'trima' }]
    });
  },

  // Kaufman Adaptive MA - using talib
  kama: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'KAMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 9 } },
      outputs: [{ talib: 'outReal', result: 'kama' }]
    });
  },

  // Rate of Change - using talib
  roc: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'ROC',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } },
      outputs: [{ talib: 'outReal', result: 'roc' }]
    });
  },

  // Average True Range - using talib
  atr: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'ATR',
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } },
      outputs: [{ talib: 'outReal', result: 'atr' }]
    });
  },

  // Money Flow Index - using talib
  mfi: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'MFI',
      inputs: ['high', 'low', 'close', 'volume'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } },
      outputs: [{ talib: 'outReal', result: 'mfi' }]
    });
  },

  // Simple Moving Average - using talib
  sma: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'SMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } },
      outputs: [{ talib: 'outReal', result: 'sma' }]
    });
  },

  // Exponential Moving Average - using talib
  ema: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'EMA',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } },
      outputs: [{ talib: 'outReal', result: 'ema' }]
    });
  },

  // Relative Strength Index - using talib
  rsi: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'RSI',
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } },
      outputs: [{ talib: 'outReal', result: 'rsi' }]
    });
  },

  // Hull Moving Average - custom implementation using WMA
  // HMA = WMA(√n) of [2 × WMA(n/2) – WMA(n)]
  hma: (source: any[], indicator: Indicator) => {
    return new Promise(resolve => {
      const period = indicator?.options?.length || 9;
      const candleSource = (indicator.options && indicator.options.source) || 'close';

      // Extract source data
      let data: number[];
      if (typeof source[0] === 'object') {
        data = source.map((c: any) => c[candleSource]);
      } else {
        data = source.slice();
      }

      // HMA calculation:
      // 1. WMA(n/2) of data
      // 2. WMA(n) of data
      // 3. 2 * WMA(n/2) - WMA(n)
      // 4. WMA(√n) of result from step 3

      const halfPeriod = Math.floor(period / 2);
      const sqrtPeriod = Math.floor(Math.sqrt(period));

      // Calculate WMA(n/2) and WMA(n)
      const wmaHalf = calculateWMA(data, halfPeriod);
      const wmaFull = calculateWMA(data, period);

      // 2 * WMA(n/2) - WMA(n)
      // Need to align the arrays - wmaHalf starts at halfPeriod-1, wmaFull starts at period-1
      const offset = period - halfPeriod;
      const rawData: number[] = [];
      for (let i = 0; i < wmaFull.length; i++) {
        rawData.push(2 * wmaHalf[i + offset] - wmaFull[i]);
      }

      // Final WMA(√n)
      const hma = calculateWMA(rawData, sqrtPeriod);

      resolve({ [indicator.key]: hma });
    });
  },

  // Commodity Channel Index - using talib
  cci: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'CCI',
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 20 } },
      outputs: [{ talib: 'outReal', result: 'cci' }]
    });
  },

  // Volume Weighted MA - custom implementation
  // VWMA = Sum(close * volume, n) / Sum(volume, n)
  vwma: (source: any[], indicator: Indicator) => {
    return new Promise(resolve => {
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

      resolve({ [indicator.key]: result });
    });
  },

  // Stochastic Oscillator - using talib
  stoch: (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;
    const k = options.k || 3;
    const d = options.d || 3;
    const length = options.length || 14;

    return new Promise(resolve => {
      talib.execute({
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
      }, (err: any, result: any) => {
        if (err || !result) {
          resolve({ [indicator.key]: [] });
          return;
        }

        const finalResult: any[] = [];
        for (let i = 0; i < result.nbElement; i++) {
          finalResult.push({
            stoch_k: result.result.outSlowK[i],
            stoch_d: result.result.outSlowD[i]
          });
        }
        resolve({ [indicator.key]: finalResult });
      });
    });
  },

  // MACD - using talib
  macd: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'MACD',
      optInputs: {
        fast_length: { talibKey: 'optInFastPeriod', default: 12 },
        slow_length: { talibKey: 'optInSlowPeriod', default: 26 },
        signal_length: { talibKey: 'optInSignalPeriod', default: 9 }
      },
      outputs: [
        { talib: 'outMACD', result: 'macd' },
        { talib: 'outMACDSignal', result: 'signal' },
        { talib: 'outMACDHist', result: 'histogram' }
      ]
    });
  },

  // Average Directional Index - using talib
  adx: (source: any[], indicator: Indicator) => {
    return executeTalibIndicator(source, indicator, {
      name: 'ADX',
      inputs: ['high', 'low', 'close'],
      optInputs: { length: { talibKey: 'optInTimePeriod', default: 14 } },
      outputs: [{ talib: 'outReal', result: 'adx' }]
    });
  },

  macd_ext: function (source: any[], indicator: Indicator) {
    return new Promise(resolve => {
      const getMaTypeFromString = function (maType: string): number {
        const types = ['SMA', 'EMA', 'WMA', 'DEMA', 'TEMA', 'TRIMA', 'KAMA', 'MAMA', 'T3'];
        return types.includes(maType) ? types.indexOf(maType) : 1;
      };

      const { options = {} } = indicator;
      const { default_ma_type = 'EMA' } = options;
      const { fast_ma_type = default_ma_type } = options;
      const { slow_ma_type = default_ma_type } = options;
      const { signal_ma_type = default_ma_type } = options;

      talib.execute(
        {
          name: 'MACDEXT',
          startIdx: 0,
          endIdx: source.length - 1,
          inReal: source.slice(),
          optInFastPeriod: options.fast_period || 12,
          optInSlowPeriod: options.slow_period || 26,
          optInSignalPeriod: options.signal_period || 9,
          optInFastMAType: getMaTypeFromString(fast_ma_type),
          optInSlowMAType: getMaTypeFromString(slow_ma_type),
          optInSignalMAType: getMaTypeFromString(signal_ma_type)
        },
        (err: any, result: any) => {
          const resultHistory: any[] = [];
          for (let i = 0; i < result.nbElement; i += 1) {
            resultHistory.push({
              macd: result.result.outMACD[i],
              histogram: result.result.outMACDHist[i],
              signal: result.result.outMACDSignal[i]
            });
          }
          resolve({ [indicator.key]: resultHistory });
        }
      );
    });
  },

  bb_talib: function (source: any[], indicator: Indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { length = 20, stddev = 2 } = options;
      talib.execute(
        {
          name: 'BBANDS',
          startIdx: 0,
          endIdx: source.length - 1,
          inReal: source.slice(),
          optInTimePeriod: length,
          optInNbDevUp: stddev,
          optInNbDevDn: stddev,
          optInMAType: 0
        },
        (err: any, result: any) => {
          if (err) {
            resolve({ [indicator.key]: {} });
            return;
          }

          const resultHistory: any[] = [];
          for (let i = 0; i < result.nbElement; i += 1) {
            resultHistory.push({
              upper: result.result.outRealUpperBand[i],
              middle: result.result.outRealMiddleBand[i],
              lower: result.result.outRealLowerBand[i],
              width: (result.result.outRealUpperBand[i] - result.result.outRealLowerBand[i]) / result.result.outRealMiddleBand[i]
            });
          }
          resolve({ [indicator.key]: resultHistory });
        }
      );
    });
  },

  stoch_rsi: function (source: any[], indicator: Indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { rsi_length = 14, stoch_length = 14, k = 3, d = 3 } = options;

      const { StochasticRSI } = require('technicalindicators');
      const f = new StochasticRSI({
        values: source,
        rsiPeriod: rsi_length,
        stochasticPeriod: stoch_length,
        kPeriod: k,
        dPeriod: d
      });

      const result: any[] = [];
      const results = f.getResult();

      for (let i = 0; i < results.length; i++) {
        result.push({
          stoch_k: results[i].k,
          stoch_d: results[i].d
        });
      }

      resolve({ [indicator.key]: result });
    });
  },

  psar: function (source: any[], indicator: Indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { step = 0.02, max = 0.2 } = options;

      const input: any = {
        high: [],
        low: [],
        step: step,
        max: max
      };

      source.forEach((candle: any) => {
        input.high.push(candle.high);
        input.low.push(candle.low);
      });

      const { PSAR } = require('technicalindicators');
      resolve({ [indicator.key]: new PSAR(input).getResult() });
    });
  },

  heikin_ashi: function (source: Candlestick[], indicator: Indicator) {
    return new Promise(resolve => {
      const { HeikinAshi } = require('technicalindicators');

      const input: any = {
        close: [],
        high: [],
        low: [],
        open: [],
        timestamp: [],
        volume: []
      };

      source.forEach((candle: Candlestick) => {
        input.close.push(candle.close);
        input.high.push(candle.high);
        input.low.push(candle.low);
        input.open.push(candle.open);
        input.timestamp.push(candle.time);
        input.volume.push(candle.volume);
      });

      const f = new HeikinAshi(input);
      const results = f.getResult();
      const candles: Candlestick[] = [];

      const { length } = results.open || [];
      for (let i = 0; i < length; i++) {
        candles.push({
          close: results.close[i],
          high: results.high[i],
          low: results.low[i],
          open: results.open[i],
          time: results.timestamp[i],
          volume: results.volume[i]
        } as Candlestick);
      }

      resolve({ [indicator.key]: candles });
    });
  },

  volume_profile: function (source: Candlestick[], indicator: Indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { length = 200, ranges = 14 } = options;

      const { candles2MarketData } = require('./technical_analysis');
      const { VolumeProfile } = require('technicalindicators');
      const f = new VolumeProfile({ ...candles2MarketData(source, length), noOfBars: ranges });

      resolve({ [indicator.key]: f.getResult() });
    });
  },

  volume_by_price: function (source: Candlestick[], indicator: Indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { length = 200, ranges = 12 } = options;

      const lookbackRange = source.slice(-length);

      const minMax = lookbackRange.reduce(
        (accumulator, currentValue) => [Math.min(currentValue.close, accumulator[0]), Math.max(currentValue.close, accumulator[1])],
        [Number.MAX_VALUE, Number.MIN_VALUE]
      );

      const rangeSize = (minMax[1] - minMax[0]) / ranges;
      const rangeBlocks: any[] = [];

      let current = minMax[0];
      for (let i = 0; i < ranges; i++) {
        const map = lookbackRange.filter(c => c.close >= current && c.close < current + rangeSize).map(c => c.volume);

        rangeBlocks.push({
          low: i === 0 ? current * 0.9999 : current,
          high: i === ranges - 1 ? minMax[1] * 1.0001 : current + rangeSize,
          volume: map.length > 0 ? map.reduce((x, y) => x + y) : 0
        });

        current += rangeSize;
      }

      resolve({ [indicator.key]: [rangeBlocks.reverse()] });
    });
  },

  zigzag: function (source: Candlestick[], indicator: Indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { length = 1000, deviation = 5 } = options;

      const result = zigzag(source.slice(-length), deviation);

      const turningPoints = result.map(r => (r && r.turningPoint === true ? r : {}));
      resolve({ [indicator.key]: turningPoints });
    });
  },

  ichimoku_cloud: function (source: Candlestick[], indicator: Indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { conversionPeriod = 9, basePeriod = 26, spanPeriod = 52, displacement = 26 } = options;

      const { candles2MarketData } = require('./technical_analysis');
      const { IchimokuCloud } = require('technicalindicators');
      const f = new IchimokuCloud({
        ...candles2MarketData(source, undefined, ['high', 'low']),
        conversionPeriod: conversionPeriod,
        basePeriod: basePeriod,
        spanPeriod: spanPeriod,
        displacement: displacement
      });

      resolve({ [indicator.key]: f.getResult() });
    });
  },

  pivot_points_high_low: function (source: Candlestick[], indicator: Indicator) {
    const { key, options = {} } = indicator;
    const { left = 5, right = 5 } = options;
    return new Promise(resolve => {
      const result: any[] = [];

      for (let i = 0; i < source.length; i += 1) {
        const start = i - left - right;
        if (start < 0) {
          result.push({});
          continue;
        }
        const { getPivotPointsWithWicks } = require('./technical_analysis');
        result.push(getPivotPointsWithWicks(source.slice(start, i + 1), left, right));
      }
      resolve({ [key]: result });
    });
  },

  wicked: function (source: Candlestick[], indicator: Indicator) {
    const { key } = indicator;
    return new Promise(resolve => {
      const results: any[] = [];
      const { candles2MarketData } = require('./technical_analysis');
      const marketData = candles2MarketData(source, undefined, ['high', 'close', 'open', 'low']);
      for (let i = 0; i < marketData.close.length; i++) {
        const top = marketData.high[i] - Math.max(marketData.close[i], marketData.open[i]);
        const bottom = marketData.low[i] - Math.min(marketData.close[i], marketData.open[i]);

        results.push({
          top: Math.abs(percent.calc(top, marketData.high[i] - marketData.low[i], 2)),
          body: Math.abs(percent.calc(marketData.close[i] - marketData.open[i], marketData.high[i] - marketData.low[i], 2)),
          bottom: Math.abs(percent.calc(bottom, marketData.high[i] - marketData.low[i], 2))
        });
      }
      resolve({ [key]: results.reverse() });
    });
  },

  candles: async (source: any[], indicator: Indicator) => ({
    [indicator.key]: source.slice()
  })
};

export default indicators;
