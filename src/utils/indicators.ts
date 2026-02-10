const tulind = require('tulind');
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

interface TulindOptions {
  sources?: any;
  options?: any;
  results?: string[];
}

function executeTulindIndicator(source: any[], indicator: Indicator, tulindOptions: TulindOptions): Promise<IndicatorResult> {
  return new Promise(resolve => {
    const indicatorName = indicator.indicator === 'bb' ? 'bbands' : indicator.indicator as string;
    let { sources, options = {} } = tulindOptions;

    sources = sources ? sources.map(s => source.map((ss: any) => ss[s])) : [source];

    const indicatorOptions = indicator.options || {};
    options = Object.keys(options).map(o => indicatorOptions[o] || options[o]);

    (tulind.indicators as any)[indicatorName].indicator(sources as any, options as any, (err: any, res: any) => {
      let finalResult = res[0];
      const { results } = tulindOptions;
      if (results !== undefined) {
        finalResult = res[0].map((r: any, i: number) => {
          const record = results.reduce((acc: any, key: string) => Object.assign(acc, { [key]: res[results.indexOf(key)][i] }), {});
          if (indicatorName === 'bbands') {
            Object.assign(record, { width: (record.upper - record.lower) / record.middle });
          }
          return record;
        });
      }
      resolve({ [indicator.key]: finalResult });
    });
  });
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

export const indicators = {
  bb: (source: any[], indicator: Indicator) => {
    const { options = {} } = indicator;

    return executeTulindIndicator(source, indicator, {
      options: {
        length: options.length || 20,
        stddev: options.stddev || 2
      },
      results: ['lower', 'middle', 'upper']
    });
  },

  obv: (source: any[], indicator: Indicator) => executeTulindIndicator(source, indicator, { sources: ['close', 'volume'] }),
  ao: (source: any[], indicator: Indicator) => executeTulindIndicator(source, indicator, { sources: ['high', 'low'] }),
  wma: (source: any[], indicator: Indicator) => executeTulindIndicator(source, indicator, { options: { length: 9 } }),
  dema: (source: any[], indicator: Indicator) => executeTulindIndicator(source, indicator, { options: { length: 9 } }),
  tema: (source: any[], indicator: Indicator) => executeTulindIndicator(source, indicator, { options: { length: 9 } }),
  trima: (source: any[], indicator: Indicator) => executeTulindIndicator(source, indicator, { options: { length: 9 } }),
  kama: (source: any[], indicator: Indicator) => executeTulindIndicator(source, indicator, { options: { length: 9 } }),

  roc: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  atr: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['high', 'low', 'close'],
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  mfi: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['high', 'low', 'close', 'volume'],
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  sma: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  ema: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  rsi: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  hma: (source: any[], indicator: Indicator) => {
    const candleSource = (indicator.options && indicator.options.source) || 'close';

    return executeTulindIndicator(source, indicator, {
      sources: [candleSource],
      options: {
        length: indicator?.options?.length || 9
      }
    });
  },

  cci: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['high', 'low', 'close'],
      options: {
        length: indicator?.options?.length || 20
      }
    }),

  vwma: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['close', 'volume'],
      options: {
        length: indicator?.options?.length || 20
      }
    }),

  stoch: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['high', 'low', 'close'],
      options: { length: 14, k: 3, d: 3 },
      results: ['stoch_k', 'stoch_d']
    }),

  macd: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      results: ['macd', 'signal', 'histogram'],
      options: {
        fast_length: indicator?.options?.fast_length || 12,
        slow_length: indicator?.options?.slow_length || 26,
        signal_length: indicator?.options?.signal_length || 9
      }
    }),

  adx: (source: any[], indicator: Indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['high', 'low', 'close'],
      options: { length: 14 }
    }),

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
