const tulind = require('tulind');
const percent = require('percent');
const CustomIndicators = require('./indicators');

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
   * @param lookbacks oldest first
   * @returns {Promise<any>}
   */
  getIndicatorsLookbacks: function(lookbacks) {
    return new Promise(resolve => {
      const marketData = { open: [], close: [], high: [], low: [], volume: [] };

      lookbacks.slice(-1000).forEach(function(lookback) {
        marketData.open.push(lookback.open);
        marketData.high.push(lookback.high);
        marketData.low.push(lookback.low);
        marketData.close.push(lookback.close);
        marketData.volume.push(lookback.volume);
      });

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

  /**
   * @param indicators
   * @param lookbacks oldest first
   * @returns {Promise<any>}
   */
  createIndicatorsLookback: function(lookbacks, indicators) {
    return new Promise(resolve => {
      const marketData = { open: [], close: [], high: [], low: [], volume: [] };

      if (lookbacks.length > 1 && lookbacks[0].time > lookbacks[1].time) {
        throw 'Invalid candlestick order';
      }

      lookbacks.slice(-1000).forEach(lookback => {
        marketData.open.push(lookback.open);
        marketData.high.push(lookback.high);
        marketData.low.push(lookback.low);
        marketData.close.push(lookback.close);
        marketData.volume.push(lookback.volume);
      });

      const calculations = [];

      indicators.forEach(indicator => {
        const indicatorKey = indicator.key;
        const options = indicator.options || {};

        const indicatorName = indicator.indicator;

        if (indicatorName === 'sma' || indicatorName === 'ema') {
          const { length } = options;

          if (!length) {
            throw `Invalid length for indicator: ${JSON.stringify([indicator, options])}`;
          }

          calculations.push(
            new Promise(resolve => {
              tulind.indicators[indicatorName].indicator([marketData.close], [length], (err, results) => {
                const values = {};
                values[indicatorKey] = results[0];

                resolve(values);
              });
            })
          );
        } else if (indicatorName === 'candles') {
          calculations.push(
            new Promise(resolve => {
              const values = {};
              values[indicatorKey] = lookbacks.slice();

              resolve(values);
            })
          );
        } else if (indicatorName === 'cci') {
          let { length } = options;

          // default value
          if (!length) {
            length = 20;
          }

          calculations.push(
            new Promise(resolve => {
              tulind.indicators.cci.indicator(
                [marketData.high, marketData.low, marketData.close],
                [length],
                (err, results) => {
                  const values = {};
                  values[indicatorKey] = results[0];

                  resolve(values);
                }
              );
            })
          );
        } else if (indicatorName === 'macd') {
          calculations.push(
            new Promise(resolve => {
              const fastLength = options.fast_length || 12;
              const slowLength = options.slow_length || 26;
              const signalLength = options.signal_length || 9;

              tulind.indicators.macd.indicator(
                [marketData.close],
                [fastLength, slowLength, signalLength],
                (err, results) => {
                  const result = [];

                  for (let i = 0; i < results[0].length; i++) {
                    result.push({
                      macd: results[0][i],
                      signal: results[1][i],
                      histogram: results[2][i]
                    });
                  }

                  const values = {};
                  values[indicatorKey] = result;

                  resolve(values);
                }
              );
            })
          );
        } else if (indicatorName === 'macd_ext') {
          calculations.push(
            new Promise(resolve => {
              const talib = require('talib');

              /**
               * Extract int from string input eg (SMA = 0)
               *
               * @see https://github.com/oransel/node-talib
               * @see https://github.com/markcheno/go-talib/blob/master/talib.go#L20
               */
              const getMaTypeFromString = function(maType) {
                // no constant in lib?

                switch (maType.toUpperCase()) {
                  case 'SMA':
                    return 0;
                  case 'EMA':
                    return 1;
                  case 'WMA':
                    return 2;
                  case 'DEMA':
                    return 3;
                  case 'TEMA':
                    return 4;
                  case 'TRIMA':
                    return 5;
                  case 'KAMA':
                    return 6;
                  case 'MAMA':
                    return 7;
                  case 'T3':
                    return 8;
                  default:
                    return 1;
                }
              };

              const types = {
                fast_ma_type: options.default_ma_type || 'EMA',
                slow_ma_type: options.default_ma_type || 'EMA',
                signal_ma_type: options.default_ma_type || 'EMA'
              };

              if (options.fast_ma_type) {
                types.fast_ma_type = options.fast_ma_type;
              }

              if (options.slow_ma_type) {
                types.slow_ma_type = options.slow_ma_type;
              }

              if (options.signal_ma_type) {
                types.signal_ma_type = options.signal_ma_type;
              }

              talib.execute(
                {
                  name: 'MACDEXT',
                  startIdx: 0,
                  endIdx: marketData.close.length - 1,
                  inReal: marketData.close.slice(),
                  optInFastPeriod: options.fast_period || 12,
                  optInSlowPeriod: options.slow_period || 26,
                  optInSignalPeriod: options.signal_period || 9,
                  optInFastMAType: getMaTypeFromString(types.fast_ma_type),
                  optInSlowMAType: getMaTypeFromString(types.slow_ma_type),
                  optInSignalMAType: getMaTypeFromString(types.signal_ma_type)
                },
                function(err, result) {
                  if (err) {
                    const values = {};
                    values[indicatorKey] = [];

                    resolve(values);
                    return;
                  }
                  // Result format: (note: outReal  can have multiple items in the array)
                  // {
                  //   begIndex: 8,
                  //   nbElement: 1,
                  //   result: { outReal: [ 1820.8621111111108 ] }
                  // }
                  const resultHistory = [];
                  for (let i = 0; i < result.nbElement; i++) {
                    resultHistory.push({
                      macd: result.result.outMACD[i],
                      histogram: result.result.outMACDHist[i],
                      signal: result.result.outMACDSignal[i]
                    });
                  }

                  const values = {};
                  values[indicatorKey] = resultHistory;

                  resolve(values);
                }
              );
            })
          );
        } else if (indicatorName === 'obv') {
          calculations.push(
            new Promise(resolve => {
              tulind.indicators.obv.indicator([marketData.close, marketData.volume], [], (err, results) => {
                const values = {};
                values[indicatorKey] = results[0];

                resolve(values);
              });
            })
          );
        } else if (indicatorName === 'ao') {
          calculations.push(
            new Promise(resolve => {
              tulind.indicators.ao.indicator([marketData.high, marketData.low], [], (err, results) => {
                const values = {};
                values[indicatorKey] = results[0];

                resolve(values);
              });
            })
          );
        } else if (indicatorName === 'mfi') {
          calculations.push(
            new Promise(resolve => {
              const length = options.length || 14;

              tulind.indicators.mfi.indicator(
                [marketData.high, marketData.low, marketData.close, marketData.volume],
                [14],
                (err, results) => {
                  const values = {};
                  values[indicatorKey] = results[0];

                  resolve(values);
                }
              );
            })
          );
        } else if (indicatorName === 'rsi') {
          calculations.push(
            new Promise(resolve => {
              const length = options.length || 14;

              tulind.indicators.rsi.indicator([marketData.close], [length], (err, results) => {
                const values = {};
                values[indicatorKey] = results[0];

                resolve(values);
              });
            })
          );
        } else if (indicatorName === 'bb') {
          const length = options.length || 20;
          const stddev = options.stddev || 2;

          calculations.push(
            new Promise(resolve => {
              tulind.indicators.bbands.indicator([marketData.close], [length, stddev], (err, results) => {
                const result = [];

                for (let i = 0; i < results[0].length; i++) {
                  result.push({
                    lower: results[0][i],
                    middle: results[1][i],
                    upper: results[2][i],
                    width: (results[2][i] - results[0][i]) / results[1][i] // https://www.tradingview.com/wiki/Bollinger_Bands_Width_(BBW)
                  });
                }

                const values = {};
                values[indicatorKey] = result;

                resolve(values);
              });
            })
          );
        } else if (indicatorName === 'stoch') {
          calculations.push(
            new Promise(resolve => {
              const length = options.length || 14;
              const k = options.k || 3;
              const d = options.d || 3;

              tulind.indicators.stoch.indicator(
                [marketData.high, marketData.low, marketData.close],
                [length, k, d],
                (err, results) => {
                  const result = [];

                  for (let i = 0; i < results[0].length; i++) {
                    result.push({
                      stoch_k: results[0][i],
                      stoch_d: results[1][i]
                    });
                  }

                  const values = {};
                  values[indicatorKey] = result;

                  resolve(values);
                }
              );
            })
          );
        } else if (indicatorName === 'bb_talib') {
          const talib = require('talib');

          const length = options.length || 20;
          const stddev = options.stddev || 2;

          calculations.push(
            new Promise(resolve => {
              talib.execute(
                {
                  name: 'BBANDS',
                  startIdx: 0,
                  endIdx: marketData.close.length - 1,
                  inReal: marketData.close.slice(),
                  optInTimePeriod: length,
                  optInNbDevUp: stddev,
                  optInNbDevDn: stddev,
                  optInMAType: 0 // simple moving average here
                },
                function(err, result) {
                  if (err) {
                    const values = {};
                    values[indicatorKey] = [];

                    resolve(values);
                    return;
                  }

                  const resultHistory = [];
                  for (let i = 0; i < result.nbElement; i++) {
                    resultHistory.push({
                      upper: result.result.outRealUpperBand[i],
                      middle: result.result.outRealMiddleBand[i],
                      lower: result.result.outRealLowerBand[i],
                      width:
                        (result.result.outRealUpperBand[i] - result.result.outRealLowerBand[i]) /
                        result.result.outRealMiddleBand[i] // https://www.tradingview.com/wiki/Bollinger_Bands_Width_(BBW)
                    });
                  }

                  const values = {};
                  values[indicatorKey] = resultHistory;

                  resolve(values);
                }
              );
            })
          );
        } else if (indicatorName === 'stoch_rsi') {
          calculations.push(
            new Promise(resolve => {
              const rsiLength = options.rsi_length || 14;
              const stochLength = options.stoch_length || 14;
              const k = options.k || 3;
              const d = options.d || 3;

              // only "technicalindicators" working fluently here
              const { StochasticRSI } = require('technicalindicators');

              const f = new StochasticRSI({
                values: marketData.close,
                rsiPeriod: rsiLength,
                stochasticPeriod: stochLength,
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

              resolve({
                [indicatorKey]: result
              });
            })
          );
        } else if (indicatorName === 'pivot_points_high_low') {
          const left = options.left || 5;
          const right = options.right || 5;

          calculations.push(
            new Promise(resolve => {
              const result = [];

              for (let i = 0; i < lookbacks.length; i++) {
                const start = i - left - right;
                if (start < 0) {
                  result.push({});
                  continue;
                }

                result.push(this.getPivotPointsWithWicks(lookbacks.slice(start, i + 1), left, right));
              }

              result[indicatorKey] = result;

              resolve(result);
            })
          );
        } else if (indicatorName === 'hma') {
          const length = options.length || 9;

          calculations.push(
            new Promise(resolve => {
              tulind.indicators.hma.indicator([marketData.close], [length], function(err, results) {
                resolve({
                  [indicatorKey]: results[0]
                });
              });
            })
          );
        } else if (indicatorName === 'vwma') {
          const length = options.length || 20;

          calculations.push(
            new Promise(resolve => {
              tulind.indicators.vwma.indicator([marketData.close, marketData.volume], [length], function(err, results) {
                resolve({
                  [indicatorKey]: results[0]
                });
              });
            })
          );
        } else if (indicatorName === 'atr') {
          const length = options.length || 14;

          calculations.push(
            new Promise(resolve => {
              tulind.indicators.atr.indicator([marketData.high, marketData.low, marketData.close], [length], function(
                err,
                results
              ) {
                resolve({
                  [indicatorKey]: results[0]
                });
              });
            })
          );
        } else if (indicatorName === 'roc') {
          const length = options.length || 6;

          calculations.push(
            new Promise(resolve => {
              tulind.indicators.roc.indicator([marketData.close], [length], function(err, results) {
                resolve({
                  [indicatorKey]: results[0]
                });
              });
            })
          );
        } else if (indicatorName === 'adx') {
          const length = options.length || 14;
          calculations.push(
            new Promise(resolve => {
              tulind.indicators.adx.indicator([marketData.high, marketData.low, marketData.close], [length], function(
                err,
                results
              ) {
                resolve({
                  [indicatorKey]: results[0]
                });
              });
            })
          );
        } else if (indicatorName === 'volume_profile') {
          calculations.push(
            new Promise(resolve => {
              const length = options.length || 200;
              const bars = options.ranges || 14;

              const { VolumeProfile } = require('technicalindicators');

              const f = new VolumeProfile({
                high: marketData.high.slice(-length),
                open: marketData.open.slice(-length),
                low: marketData.low.slice(-length),
                close: marketData.close.slice(-length),
                volume: marketData.volume.slice(-length),
                noOfBars: bars
              });

              const results = f.getResult();

              resolve({
                [indicatorKey]: [results]
              });
            })
          );
        } else if (indicatorName === 'volume_by_price') {
          // https://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:volume_by_price
          const length = options.length || 200;
          const ranges = options.ranges || 12;

          calculations.push(
            new Promise(resolve => {
              const lookbackRange = lookbacks.slice(-length);

              const minMax = lookbackRange.reduce(
                (accumulator, currentValue) => {
                  return [Math.min(currentValue.close, accumulator[0]), Math.max(currentValue.close, accumulator[1])];
                },
                [Number.MAX_VALUE, Number.MIN_VALUE]
              );

              const rangeSize = (minMax[1] - minMax[0]) / ranges;
              const rangeBlocks = [];

              let current = minMax[0];
              for (let i = 0; i < ranges; i++) {
                // summarize volume per range
                const map = lookbackRange
                  .filter(c => c.close >= current && c.close < current + rangeSize)
                  .map(c => c.volume);

                // prevent float / rounding issues on first and last item
                rangeBlocks.push({
                  low: i === 0 ? current * 0.9999 : current,
                  high: i === ranges - 1 ? minMax[1] * 1.0001 : current + rangeSize,
                  volume: map.length > 0 ? map.reduce((x, y) => x + y) : 0
                });

                current += rangeSize;
              }

              resolve({
                [indicatorKey]: [rangeBlocks.reverse()] // sort by price; low to high
              });
            })
          );
        } else if (indicatorName === 'zigzag') {
          const deviation = options.deviation || 5;
          const length = options.length || 1000;

          calculations.push(
            new Promise(resolve => {
              const result = CustomIndicators.zigzag(lookbacks.slice(-length), deviation);

              // we only what to have turningPoints; non turningPoints should be empty lookback
              const turningPoints = result.map(r => {
                return r && r.turningPoint === true ? r : {};
              });

              resolve({
                [indicatorKey]: turningPoints
              });
            })
          );
        }
      });

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
    if (left + right + 1 > prices.length || left <= 1 || right <= 1) {
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
    if (left + right + 1 > candles.length || left <= 1 || right <= 1) {
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
