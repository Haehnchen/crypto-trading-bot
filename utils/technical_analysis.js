const tulind = require('tulind')
const percent = require('percent')

module.exports = {
    /**
     * https://www.tradingview.com/wiki/Bollinger_Bands_%25B_(%25B)
     *
     * @param currentPrice
     * @param upper
     * @param lower
     * @returns {number} percent value in integer
     */
    getBollingerBandPrice: function (currentPrice, upper, lower) {
        return ((currentPrice - lower) / (upper - lower)) * 100
    },

    /**
     * https://www.tradingview.com/wiki/Bollinger_Bands_%25B_(%25B)
     *
     * @param currentPrice
     * @param upper
     * @param lower
     * @returns {number} percent value in integer
     */
    getPercentTrendStrength: function (lookbackPrices) {
        if (lookbackPrices.length < 9) {
            return undefined
        }

        let slice = lookbackPrices.slice(-4);
        console.log(slice)

        let b = slice[slice.length - 1] - slice[0]

        console.log(b)

        console.log(Math.atan2(3, b) * 180 / Math.PI)



        return ((currentPrice - lower) / (upper - lower)) * 100
    },

    /**
     * @param lookbacks oldest first
     * @returns {Promise<any>}
     */
    getIndicatorsLookbacks: function (lookbacks) {
        return new Promise((resolve) => {

            let marketData = { open: [], close: [], high: [], low: [], volume: [] }

            lookbacks.slice(-1000).forEach(function (lookback) {
                marketData.open.push(lookback.open)
                marketData.high.push(lookback.high)
                marketData.low.push(lookback.low)
                marketData.close.push(lookback.close)
                marketData.volume.push(lookback.volume)
            })

            let calculations = [
                new Promise((resolve) => {
                    tulind.indicators.sma.indicator([marketData.close], [200], (err, results) => {
                        resolve({
                            'sma_200': results[0],
                        })
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.sma.indicator([marketData.close], [50], (err, results) => {
                        resolve({
                            'sma_50': results[0],
                        })
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.ema.indicator([marketData.close], [55], (err, results) => {
                        resolve({
                            'ema_55': results[0],
                        })
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.ema.indicator([marketData.close], [200], (err, results) => {
                        resolve({
                            'ema_200': results[0],
                        })
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.rsi.indicator([marketData.close], [14], (err, results) => {
                        resolve({
                            'rsi': results[0],
                        })
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.cci.indicator([marketData.high, marketData.low, marketData.close], [20], (err, results) => {
                        resolve({
                            'cci': results[0],
                        })
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.ao.indicator([marketData.high, marketData.low], [], (err, results) => {
                        resolve({
                            'ao': results[0],
                        })
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.macd.indicator([marketData.close], [12, 26, 9], (err, results) => {
                        let result = [];

                        for (let i = 0; i < results[0].length; i++) {
                            result.push({
                                'macd': results[0][i],
                                'signal': results[1][i],
                                'histogram': results[2][i],
                            })
                        }

                        resolve({'macd': result})
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.mfi.indicator([marketData.high, marketData.low, marketData.close, marketData.volume], [14], (err, results) => {
                        resolve({
                            'mfi': results[0],
                        })
                    })
                }),
                new Promise((resolve) => {
                    tulind.indicators.bbands.indicator([marketData.close], [20, 2], (err, results) => {
                        let result = [];

                        for (let i = 0; i < results[0].length; i++) {
                            result.push({
                                'lower': results[0][i],
                                'middle': results[1][i],
                                'upper': results[2][i],
                            })
                        }

                        resolve({'bollinger_bands': result})
                    })
                }),
                new Promise((resolve) => {
                    let results = [];

                    for (let i = 0; i < marketData.close.length; i++) {
                        let top = marketData.high[i] - Math.max(marketData.close[i], marketData.open[i])
                        let bottom = marketData.low[i] - Math.min(marketData.close[i], marketData.open[i])

                        results.push({
                            'top': Math.abs(percent.calc(top, marketData.high[i] - marketData.low[i], 2)),
                            'body': Math.abs(percent.calc(marketData.close[i] - marketData.open[i], marketData.high[i] - marketData.low[i], 2)),
                            'bottom': Math.abs(percent.calc(bottom, marketData.high[i] - marketData.low[i], 2)),
                        })
                    }

                    resolve({'wicked': results.reverse()})
                }),
                new Promise((resolve) => {
                    const StochasticRSI = require('technicalindicators').StochasticRSI;

                    let f = new StochasticRSI({
                        values: marketData.close,
                        rsiPeriod: 14,
                        stochasticPeriod: 14,
                        kPeriod: 3,
                        dPeriod: 3,
                    })

                    resolve({'stoch_rsi': f.getResult()})
                }),
            ]

            Promise.all(calculations).then((values) => {

                let results = {}

                values.forEach((value) => {
                    for (let key in value) {
                        results[key] = value[key]
                    }
                })

                resolve(results)
            })
        })
    },


    /**
     * @param indicators
     * @param lookbacks oldest first
     * @returns {Promise<any>}
     */
    createIndicatorsLookback: function (lookbacks, indicators) {
        return new Promise((resolve) => {
            let marketData = { open: [], close: [], high: [], low: [], volume: [] }

            if (lookbacks.length > 1 && lookbacks[0].time > lookbacks[1].time) {
                throw 'Invalid candlestick order'
            }

            lookbacks.slice(-1000).forEach(function (lookback) {
                marketData.open.push(lookback.open)
                marketData.high.push(lookback.high)
                marketData.low.push(lookback.low)
                marketData.close.push(lookback.close)
                marketData.volume.push(lookback.volume)
            })

            let calculations = []

            indicators.forEach((indicator) => {
                let indicatorKey = indicator.key
                let options = indicator.options || {}

                let indicatorName = indicator.indicator;

                if (indicatorName === 'sma' || indicatorName === 'ema') {
                    let length = options['length']

                    if (!length) {
                        throw 'Invalid length for indicator: ' + JSON.stringify(indicator)
                    }

                    calculations.push(new Promise((resolve) => {
                         tulind.indicators[indicatorName].indicator([marketData.close], [length], (err, results) => {
                            let values = {}
                            values[indicatorKey] = results[0]

                            resolve(values)
                        })
                    }))
                } else if (indicatorName === 'cci') {
                    let length = options['length']

                    // default value
                    if (!length) {
                        length = 20
                    }

                    calculations.push(new Promise((resolve) => {
                        tulind.indicators.cci.indicator([marketData.high, marketData.low, marketData.close], [length], (err, results) => {
                            let values = {}
                            values[indicatorKey] = results[0]

                            resolve(values)
                        })
                    }))
                } else if (indicatorName === 'macd') {
                    calculations.push(new Promise((resolve) => {
                        tulind.indicators.macd.indicator([marketData.close], [12, 26, 9], (err, results) => {
                            let result = [];

                            for (let i = 0; i < results[0].length; i++) {
                                result.push({
                                    'macd': results[0][i],
                                    'signal': results[1][i],
                                    'histogram': results[2][i],
                                })
                            }

                            let values = {}
                            values[indicatorKey] = result

                            resolve(values)
                        })
                    }))
                } else if (indicatorName === 'macd_ext') {
                    calculations.push(new Promise((resolve) => {
                        let talib = require('talib')

                        /**
                         * Extract int from string input eg (SMA = 0)
                         *
                         * @see https://github.com/oransel/node-talib
                         * @see https://github.com/markcheno/go-talib/blob/master/talib.go#L20
                         */
                        let getMaTypeFromString = function(maType) {
                            // no constant in lib?

                            switch (maType.toUpperCase()) {
                                case 'SMA':
                                    return 0
                                case 'EMA':
                                    return 1
                                case 'WMA':
                                    return 2
                                case 'DEMA':
                                    return 3
                                case 'TEMA':
                                    return 4
                                case 'TRIMA':
                                    return 5
                                case 'KAMA':
                                    return 6
                                case 'MAMA':
                                    return 7
                                case 'T3':
                                    return 8
                                default:
                                    return 0
                            }
                        }

                        let types = {
                            'fast_ma_type': options['default_ma_type'] || 'EMA',
                            'slow_ma_type': options['default_ma_type'] || 'EMA',
                            'signal_ma_type': options['default_ma_type'] || 'EMA',
                        }

                        if (options['fast_ma_type']) {
                            types['fast_ma_type'] = options['fast_ma_type']
                        }

                        if (options['slow_ma_type']) {
                            types['slow_ma_type'] = options['slow_ma_type']
                        }

                        if (options['signal_ma_type']) {
                            types['signal_ma_type'] = options['signal_ma_type']
                        }

                        talib.execute({
                            name: 'MACDEXT',
                            startIdx: 0,
                            endIdx: marketData.close.length -1,
                            inReal: marketData.close.slice(),
                            optInFastPeriod: options['fast_period'] || 12,
                            optInSlowPeriod: options['slow_period'] || 26,
                            optInSignalPeriod: options['signal_period'] || 9,
                            optInFastMAType: getMaTypeFromString(types['fast_ma_type']),
                            optInSlowMAType: getMaTypeFromString(types['slow_ma_type']),
                            optInSignalMAType: getMaTypeFromString(types['signal_ma_type']),
                        }, function (err, result) {
                            if (err) {
                                resolve({})
                                return
                            }
                            // Result format: (note: outReal  can have multiple items in the array)
                            // {
                            //   begIndex: 8,
                            //   nbElement: 1,
                            //   result: { outReal: [ 1820.8621111111108 ] }
                            // }
                            let resultHistory = [];
                            for (let i = 0; i < result.nbElement; i++) {
                                resultHistory.push({
                                    'macd': result.result.outMACD[i],
                                    'histogram': result.result.outMACDHist[i],
                                    'signal': result.result.outMACDSignal[i],
                                })
                            }

                            let values = {}
                            values[indicatorKey] = resultHistory

                            resolve(values)
                        })

                    }))
                } else if (indicatorName === 'obv') {
                    calculations.push(new Promise((resolve) => {
                        tulind.indicators.obv.indicator([marketData.close, marketData.volume], [], (err, results) => {
                            let values = {}
                            values[indicatorKey] = results[0]

                            resolve(values)
                        })
                    }))
                }
            })

            Promise.all(calculations).then((values) => {
                let results = {}

                values.forEach((value) => {
                    for (let key in value) {
                        results[key] = value[key]
                    }
                })

                resolve(results)
            })
        })
    },

    getTrendingDirection: function(lookbacks) {
        let currentValue = lookbacks.slice(-1)[0]

        return ((lookbacks[lookbacks.length - 2] + lookbacks[lookbacks.length - 3] + lookbacks[lookbacks.length - 4]) / 3 > currentValue) ? 'down' : 'up';
    },

    getTrendingDirectionLastItem: function(lookbacks) {
        return lookbacks[lookbacks.length - 2] > lookbacks[lookbacks.length - 1] ? 'down' : 'up'
    },

    getCrossedSince: function(lookbacks) {
        let values = lookbacks.slice().reverse(lookbacks)

        let currentValue = values[0]

        if(currentValue < 0) {
            for (let i = 1; i < values.length - 1; i++) {
                if(values[i] > 0) {
                    return i
                }
            }

            return
        }

        for (let i = 1; i < values.length - 1; i++) {
            if(values[i] < 0) {
                return i
            }
        }

        return undefined
    }
}


