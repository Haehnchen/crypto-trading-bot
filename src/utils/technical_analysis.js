const tulind = require('tulind');
const percent = require('percent');
const Indicators = require('./indicators');

module.exports = {
  /**
   * https://www.tradingview.com/wiki/Bollinger_Bands_%25B_(%25B)
   *
   * @param currentPrice
   * @param upper
   * @param lower
   * @returns {number} percent value in integer
   */
  getBollingerBandPercent: function(currentPrice, upper, lower) {
    return (currentPrice - lower) / (upper - lower);
  },

  /**
   * https://www.tradingview.com/wiki/Bollinger_Bands_%25B_(%25B)
   *
   * @param currentPrice
   * @param upper
   * @param lower
   * @returns {number} percent value in integer
   */
  getPercentTrendStrength: function(lookbackPrices) {
    if (lookbackPrices.length < 9) {
      return undefined;
    }

    const slice = lookbackPrices.slice(-4);
    console.log(slice);

    const b = slice[slice.length - 1] - slice[0];

    console.log(b);

    console.log((Math.atan2(3, b) * 180) / Math.PI);

    return ((currentPrice - lower) / (upper - lower)) * 100;
  },

  /**
   * 
   * @param {*} canles 
   * @param {*} lenght 
   */
  candles2MarketData: function(candles, length = 1000, keys = ['open', 'close', 'high', 'low', 'volume']) {
    return keys.reduce((acc, k) => ({ ...acc, [k]: candles.slice(-length).map(c => c[k]) }), {});
  },

  /**
   * @param lookbacks oldest first
   * @returns {Promise<any>}
   */
  getIndicatorsLookbacks: function(lookbacks) {
    return new Promise(resolve => {
      const marketData = this.candles2MarketData(lookbacks);

      const calculations = [
        new Promise(resolve => {
          tulind.indicators.sma.indicator([marketData.close], [200], (err, results) => {
            resolve({
              sma_200: results[0]
            });
          });
        }),
        new Promise(resolve => {
          tulind.indicators.sma.indicator([marketData.close], [50], (err, results) => {
            resolve({
              sma_50: results[0]
            });
          });
        }),
        new Promise(resolve => {
          tulind.indicators.ema.indicator([marketData.close], [55], (err, results) => {
            resolve({
              ema_55: results[0]
            });
          });
        }),
        new Promise(resolve => {
          tulind.indicators.ema.indicator([marketData.close], [200], (err, results) => {
            resolve({
              ema_200: results[0]
            });
          });
        }),
        new Promise(resolve => {
          tulind.indicators.rsi.indicator([marketData.close], [14], (err, results) => {
            resolve({
              rsi: results[0]
            });
          });
        }),
        new Promise(resolve => {
          tulind.indicators.cci.indicator([marketData.high, marketData.low, marketData.close], [20], (err, results) => {
            resolve({
              cci: results[0]
            });
          });
        }),
        new Promise(resolve => {
          tulind.indicators.ao.indicator([marketData.high, marketData.low], [], (err, results) => {
            resolve({
              ao: results[0]
            });
          });
        }),
        new Promise(resolve => {
          tulind.indicators.macd.indicator([marketData.close], [12, 26, 9], (err, results) => {
            const result = [];

            for (let i = 0; i < results[0].length; i++) {
              result.push({
                macd: results[0][i],
                signal: results[1][i],
                histogram: results[2][i]
              });
            }

            resolve({ macd: result });
          });
        }),
        new Promise(resolve => {
          tulind.indicators.mfi.indicator(
            [marketData.high, marketData.low, marketData.close, marketData.volume],
            [14],
            (err, results) => {
              resolve({
                mfi: results[0]
              });
            }
          );
        }),
        new Promise(resolve => {
          tulind.indicators.bbands.indicator([marketData.close], [20, 2], (err, results) => {
            const result = [];

            for (let i = 0; i < results[0].length; i++) {
              result.push({
                lower: results[0][i],
                middle: results[1][i],
                upper: results[2][i]
              });
            }

            resolve({ bollinger_bands: result });
          });
        }),
        new Promise(resolve => {
          const results = [];

          for (let i = 0; i < marketData.close.length; i++) {
            const top = marketData.high[i] - Math.max(marketData.close[i], marketData.open[i]);
            const bottom = marketData.low[i] - Math.min(marketData.close[i], marketData.open[i]);

            results.push({
              top: Math.abs(percent.calc(top, marketData.high[i] - marketData.low[i], 2)),
              body: Math.abs(
                percent.calc(marketData.close[i] - marketData.open[i], marketData.high[i] - marketData.low[i], 2)
              ),
              bottom: Math.abs(percent.calc(bottom, marketData.high[i] - marketData.low[i], 2))
            });
          }

          resolve({ wicked: results.reverse() });
        }),
        new Promise(resolve => {
          const { StochasticRSI } = require('technicalindicators');

          const f = new StochasticRSI({
            values: marketData.close,
            rsiPeriod: 14,
            stochasticPeriod: 14,
            kPeriod: 3,
            dPeriod: 3
          });

          resolve({ stoch_rsi: f.getResult() });
        })
      ];

      Promise.all(calculations).then(values => {
        const results = {};

        values.forEach(value => {
          for (const key in value) {
            results[key] = value[key];
          }
        });

        resolve(results);
      });
    });
  },

  calculateIndicatorsLookback: function(indicators, results) {
    const { sourceCandle } = Indicators;
    return indicators
      .map(indicator => (
        { ...indicator, source: indicator.source || (sourceCandle.includes(indicator.indicator) ? 'candles' : 'close') })) // figure out indicator source    
      .filter(({ key }) => !(key in results)) // skip already calculated indicators
      .filter(({ source }) => source in results.candles[0] || source in results) // skip without source data
      .map(indicator => {

        const { indicator: indicatorName, source } = indicator;
        
        // Extract source from candle if it's candle data
        const sourceData = source in results.candles[0] ? results.candles.map(v => v[source]) : results[source];

        if (typeof indicatorName === 'function') {
          return indicatorName(sourceData, indicator);
        }
        if (typeof indicatorName === 'string' && typeof Indicators[indicatorName] === 'function') {
          return Indicators[indicatorName](sourceData, indicator);
        }
        throw Error(`Call to undefined indicator: ${JSON.stringify(indicator)}`);
      });
  },

  /**
   * @param indicators
   * @param lookbacks oldest first
   * @returns {Promise<any>}
   */
  createIndicatorsLookback: async function(lookbacks, indicators) {
    // return new Promise(resolve => {
    if (lookbacks.length > 1 && lookbacks[0].time > lookbacks[1].time) {
      throw Error(`'Invalid candlestick order`);
    }

    let calculations = { candles: lookbacks.slice(-1000) };
    for (let depth = 0; depth < 5; depth += 1) {
      const values = await Promise.all(this.calculateIndicatorsLookback(indicators, calculations));
      calculations = Object.assign(calculations, ...values);
    }

    return calculations;
  },

  getTrendingDirection: function(lookbacks) {
    const currentValue = lookbacks.slice(-1)[0];

    return (lookbacks[lookbacks.length - 2] + lookbacks[lookbacks.length - 3] + lookbacks[lookbacks.length - 4]) / 3 >
      currentValue
      ? 'down'
      : 'up';
  },

  getTrendingDirectionLastItem: function(lookbacks) {
    return lookbacks[lookbacks.length - 2] > lookbacks[lookbacks.length - 1] ? 'down' : 'up';
  },

  getCrossedSince: function(lookbacks) {
    const values = lookbacks.slice().reverse(lookbacks);

    const currentValue = values[0];

    if (currentValue < 0) {
      for (let i = 1; i < values.length - 1; i++) {
        if (values[i] > 0) {
          return i;
        }
      }

      return;
    }

    for (let i = 1; i < values.length - 1; i++) {
      if (values[i] < 0) {
        return i;
      }
    }

    return undefined;
  },

  /**
   * Find the pivot points on the given window with "left" and "right". If "right" or "left" values are higher this point is invalidated
   *
   * https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/pivot-points-high-low
   */
  getPivotPoints: function(prices, left, right) {
    if (left + right + 1 > prices.length || left <= 1 || right < 0) {
      return {};
    }

    // get range from end
    const range = prices.slice(-(left + right + 1));

    const middleValue = range[left];

    const result = {};

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
  },

  /**
   * Get the pivot points high and low with the candle wicks to get a range
   *
   * { high: { close: 5, high: 6 } }
   * { low: { close: 5, low: 4 } }
   *
   * https://www.fidelity.com/learning-center/trading-investing/technical-analysis/technical-indicator-guide/pivot-points-high-low
   */
  getPivotPointsWithWicks: function(candles, left, right) {
    if (left + right + 1 > candles.length || left <= 1 || right < 0) {
      return {};
    }

    // get range from end
    const range = candles.slice(-(left + right + 1));

    const result = {};
    for (const source of ['close', 'high', 'low']) {
      const middleValue = range[left][source];

      const leftRange = range.slice(0, left);
      const rightRange = range.slice(-right);

      if (
        ['close', 'high'].includes(source) &&
        typeof leftRange.find(c => c[source] > middleValue) === 'undefined' &&
        typeof rightRange.find(c => c[source] > middleValue) === 'undefined'
      ) {
        if (!result.high) {
          result.high = {};
        }

        result.high[source] = middleValue;
      }

      if (
        ['close', 'low'].includes(source) &&
        typeof leftRange.find(c => c[source] < middleValue) === 'undefined' &&
        typeof rightRange.find(c => c[source] < middleValue) === 'undefined'
      ) {
        if (!result.low) {
          result.low = {};
        }

        result.low[source] = middleValue;
      }
    }

    return result;
  }
};
