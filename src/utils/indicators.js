const tulind = require('tulind');
const talib = require('talib');
const percent = require('percent');

/**
 * ZigZag indicator
 *
 * @see https://github.com/andresilvasantos/bitprophet/blob/master/indicators.js
 *
 * @param ticks
 * @param deviation
 * @param arraySize
 * @returns {Array}
 */
function zigzag(ticks, deviation = 5, arraySize = -1) {
  // Determines percent deviation in price changes, presenting frequency and volatility in deviation. Also helps determine trend reversals.
  // Read more: http://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:zigzag
  // arraySize = -1, calculate ZigZag for all ticks
  // arraySize = n, where n >= 1, calculate the ZigZag for the last n ticks

  const turningPoints = [];
  let basePrice = -1;
  let lastDeviation = 0;
  deviation /= 100;

  const startingTick = arraySize == -1 ? 0 : ticks.length - arraySize;
  // Calculate all turning points that have a deviation equal or superior to the argument received
  for (let i = startingTick; i < ticks.length; ++i) {
    const close = parseFloat(ticks[i].close);
    const high = parseFloat(ticks[i].high);
    const low = parseFloat(ticks[i].low);
    let positiveDeviation = high / basePrice - 1;
    let negativeDeviation = low / basePrice - 1;

    if (basePrice == -1) {
      basePrice = close;
      lastDeviation = 0;
      turningPoints.push({ timePeriod: i, value: close, deviation: lastDeviation });
      continue;
    }

    // Is it a positive turning point or is it higher than the last positive one?
    if (positiveDeviation >= deviation || (positiveDeviation > 0 && lastDeviation > 0)) {
      if (lastDeviation > 0) {
        positiveDeviation += lastDeviation;
        turningPoints.pop();
      }

      turningPoints.push({ timePeriod: i, value: high, deviation: positiveDeviation });
      lastDeviation = positiveDeviation;
      basePrice = high;
    }
    // Is it a positive turning point or is it lower than the last negative one?
    else if (negativeDeviation <= -deviation || (negativeDeviation < 0 && lastDeviation < 0)) {
      if (lastDeviation < 0) {
        negativeDeviation += lastDeviation;
        turningPoints.pop();
      }

      turningPoints.push({ timePeriod: i, value: low, deviation: negativeDeviation });
      lastDeviation = negativeDeviation;
      basePrice = low;
    }
    // Add always the last one as a turning point, just to make our life easier for the next calculation
    else if (i === ticks.length - 1) {
      if (positiveDeviation > 0) turningPoints.push({ timePeriod: i, value: high, deviation: positiveDeviation });
      else turningPoints.push({ timePeriod: i, value: low, deviation: negativeDeviation });
    }
  }

  const zigzag = [];
  // Add the turning points to the returning array, calculate the values between those turning points and add them as well
  for (let i = 0; i < turningPoints.length; ++i) {
    const turningPoint = turningPoints[i];
    zigzag.push({
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

      zigzag.push({
        timePeriod: j,
        value: value,
        deviation: parseFloat((currentDeviation * 100).toFixed(2)),
        turningPoint: false
      });
    }
  }

  return zigzag;
}

function executeTulindIndicator(source, indicator, tulindOptions) {
  return new Promise(resolve => {
    const indicatorName = indicator.indicator === 'bb' ? 'bbands' : indicator.indicator;
    let { sources, options = {} } = tulindOptions;

    // extract indicator source data, for example if sources = ['open', 'high'], then it will map values from candles.
    sources = sources ? sources.map(s => source.map(ss => ss[s])) : [source];

    // set default indicator options
    const indicatorOptions = indicator.options || {};
    options = Object.keys(options).map(o => indicatorOptions[o] || options[o]);

    // execute indicator
    tulind.indicators[indicatorName].indicator(sources, options, (err, res) => {
      let finalResult = res[0];
      const { results } = tulindOptions;
      if (results !== undefined) {
        // if indicator returns multiple results, extract them
        finalResult = res[0].map((r, i) => {
          const record = results.reduce((acc, key) => Object.assign(acc, { [key]: res[results.indexOf(key)][i] }), {});
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

module.exports = {
  // indicators which source is Candles
  sourceCandle: [
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
  ],

  bb: (source, indicator) => {
    const { options = {} } = indicator;

    return executeTulindIndicator(source, indicator, {
      options: {
        length: options.length || 20,
        stddev: options.stddev || 2
      },
      results: ['lower', 'middle', 'upper']
    });
  },

  obv: (...args) => executeTulindIndicator(...args, { sources: ['close', 'volume'] }),
  ao: (...args) => executeTulindIndicator(...args, { sources: ['high', 'low'] }),
  wma: (...args) => executeTulindIndicator(...args, { options: { length: 9 } }),
  dema: (...args) => executeTulindIndicator(...args, { options: { length: 9 } }),
  tema: (...args) => executeTulindIndicator(...args, { options: { length: 9 } }),
  trima: (...args) => executeTulindIndicator(...args, { options: { length: 9 } }),
  kama: (...args) => executeTulindIndicator(...args, { options: { length: 9 } }),

  roc: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  atr: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['high', 'low', 'close'],
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  mfi: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['high', 'low', 'close', 'volume'],
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  sma: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  ema: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  rsi: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      options: {
        length: indicator?.options?.length || 14
      }
    }),

  hma: (source, indicator) => {
    const candleSource = (indicator.options && indicator.options.source) || 'close';

    return executeTulindIndicator(source, indicator, {
      sources: [candleSource],
      options: {
        length: indicator?.options?.length || 9
      }
    });
  },

  cci: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['high', 'low', 'close'],
      options: {
        length: indicator?.options?.length || 20
      }
    }),

  vwma: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      sources: ['close', 'volume'],
      options: {
        length: indicator?.options?.length || 20
      }
    }),

  stoch: (...args) =>
    executeTulindIndicator(...args, {
      sources: ['high', 'low', 'close'],
      options: { length: 14, k: 3, d: 3 },
      results: ['stoch_k', 'stoch_d']
    }),

  macd: (source, indicator) =>
    executeTulindIndicator(source, indicator, {
      results: ['macd', 'signal', 'histogram'],
      options: {
        fast_length: indicator?.options?.fast_length || 12,
        slow_length: indicator?.options?.slow_length || 26,
        signal_length: indicator?.options?.signal_length || 9
      }
    }),

  adx: (...args) =>
    executeTulindIndicator(...args, {
      sources: ['high', 'low', 'close'],
      options: { length: 14 }
    }),

  macd_ext: function (source, indicator) {
    return new Promise(resolve => {
      /**
       * Extract int from string input eg (SMA = 0)
       *
       * @see https://github.com/oransel/node-talib
       * @see https://github.com/markcheno/go-talib/blob/master/talib.go#L20
       */
      const getMaTypeFromString = function (maType) {
        // no constant in lib?
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
        (err, result) => {
          const resultHistory = [];
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

  bb_talib: function (source, indicator) {
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
          optInMAType: 0 // simple moving average here
        },
        (err, result) => {
          if (err) {
            resolve({ [indicator.key]: {} });
            return;
          }

          const resultHistory = [];
          for (let i = 0; i < result.nbElement; i += 1) {
            resultHistory.push({
              upper: result.result.outRealUpperBand[i],
              middle: result.result.outRealMiddleBand[i],
              lower: result.result.outRealLowerBand[i],
              width: (result.result.outRealUpperBand[i] - result.result.outRealLowerBand[i]) / result.result.outRealMiddleBand[i] // https://www.tradingview.com/wiki/Bollinger_Bands_Width_(BBW)
            });
          }
          resolve({ [indicator.key]: resultHistory });
        }
      );
    });
  },

  stoch_rsi: function (source, indicator) {
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

      const result = [];
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

  psar: function (source, indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { step = 0.02, max = 0.2 } = options;

      const input = {
        high: [],
        low: [],
        step: step,
        max: max
      };

      source.forEach(candle => {
        input.high.push(candle.high);
        input.low.push(candle.low);
      });

      const { PSAR } = require('technicalindicators');
      resolve({ [indicator.key]: new PSAR(input).getResult() });
    });
  },

  heikin_ashi: function (source, indicator) {
    return new Promise(resolve => {
      const { HeikinAshi } = require('technicalindicators');

      const input = {
        close: [],
        high: [],
        low: [],
        open: [],
        timestamp: [],
        volume: []
      };

      source.forEach(candle => {
        input.close.push(candle.close);
        input.high.push(candle.high);
        input.low.push(candle.low);
        input.open.push(candle.open);
        input.timestamp.push(candle.time);
        input.volume.push(candle.volume);
      });

      const f = new HeikinAshi(input);

      const results = f.getResult();

      const candles = [];

      const { length } = results.open || [];
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

      resolve({ [indicator.key]: candles });
    });
  },

  volume_profile: function (source, indicator) {
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { length = 200, ranges = 14 } = options;

      const { candles2MarketData } = require('./technical_analysis');
      const { VolumeProfile } = require('technicalindicators');
      const f = new VolumeProfile({ ...candles2MarketData(source, length), noOfBars: ranges });

      resolve({ [indicator.key]: f.getResult() });
    });
  },

  volume_by_price: function (source, indicator) {
    // https://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:volume_by_price
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { length = 200, ranges = 12 } = options;

      const lookbackRange = source.slice(-length);

      const minMax = lookbackRange.reduce(
        (accumulator, currentValue) => [Math.min(currentValue.close, accumulator[0]), Math.max(currentValue.close, accumulator[1])],
        [Number.MAX_VALUE, Number.MIN_VALUE]
      );

      const rangeSize = (minMax[1] - minMax[0]) / ranges;
      const rangeBlocks = [];

      let current = minMax[0];
      for (let i = 0; i < ranges; i++) {
        // summarize volume per range
        const map = lookbackRange.filter(c => c.close >= current && c.close < current + rangeSize).map(c => c.volume);

        // prevent float / rounding issues on first and last item
        rangeBlocks.push({
          low: i === 0 ? current * 0.9999 : current,
          high: i === ranges - 1 ? minMax[1] * 1.0001 : current + rangeSize,
          volume: map.length > 0 ? map.reduce((x, y) => x + y) : 0
        });

        current += rangeSize;
      }

      resolve({ [indicator.key]: [rangeBlocks.reverse()] }); // sort by price; low to high
    });
  },

  zigzag: function (source, indicator) {
    // https://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:volume_by_price
    return new Promise(resolve => {
      const { options = {} } = indicator;
      const { length = 1000, deviation = 5 } = options;

      const result = zigzag(source.slice(-length), deviation);

      // we only what to have turningPoints; non turningPoints should be empty lookback
      const turningPoints = result.map(r => (r && r.turningPoint === true ? r : {}));
      resolve({ [indicator.key]: turningPoints });
    });
  },

  ichimoku_cloud: function (source, indicator) {
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

  pivot_points_high_low: function (source, indicator) {
    const { key, options = {} } = indicator;
    const { left = 5, right = 5 } = options;
    return new Promise(resolve => {
      const result = [];

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

  wicked: function (source, indicator) {
    const { key } = indicator;
    return new Promise(resolve => {
      const results = [];
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

  candles: async (source, indicator) => ({
    [indicator.key]: source.slice()
  })
};
