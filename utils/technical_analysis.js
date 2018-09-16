const tulind = require('tulind');
const technicalindicators = require('technicalindicators');
let percent = require('percent');

module.exports = {
    getIndicatorsForCandleLookbackPeriod: function (lookbacks, cb) {
        let marketData = { open: [], close: [], high: [], low: [], volume: [] }

        lookbacks.slice(0, 1000).reverse().forEach(function (lookback) {
            marketData.open.push(lookback.open)
            marketData.high.push(lookback.high)
            marketData.low.push(lookback.low)
            marketData.close.push(lookback.close)
            marketData.volume.push(lookback.volume)
        })

        let calculations = [
            new Promise((resolve) => {
                tulind.indicators.ema.indicator([marketData.close], [55], (err, results) => {
                    resolve({
                        'ema_55': results[0][results[0].length-1],
                    })
                })
            }),
            new Promise((resolve) => {
                tulind.indicators.ema.indicator([marketData.close], [200], (err, results) => {
                    resolve({
                        'ema_200': results[0][results[0].length-1],
                    })
                })
            }),
            new Promise((resolve) => {
                tulind.indicators.rsi.indicator([marketData.close], [14], (err, results) => {
                    resolve({
                        'rsi': results[0][results[0].length-1],
                    })
                })
            }),
            new Promise((resolve) => {
                tulind.indicators.cci.indicator([marketData.high, marketData.low, marketData.close], [20], (err, results) => {
                    resolve({
                        'cci': results[0][results[0].length-1],
                    })
                })
            }),
            new Promise((resolve) => {
                tulind.indicators.ao.indicator([marketData.high, marketData.low], [], (err, results) => {
                    resolve({
                        'ao': results[0][results[0].length-1],
                    })
                })
            }),
            new Promise((resolve) => {
                tulind.indicators.macd.indicator([marketData.close], [12, 26, 9], (err, results) => {
                    resolve({'macd': {
                        'macd': results[0][results[0].length - 1],
                        'signal': results[1][results[2].length - 1],
                        'histogram': results[2][results[2].length - 1],
                    }})
                })
            }),
            new Promise((resolve) => {
                if(marketData.close.length < 250) {
                    resolve()
                    return
                }

                technicalindicators.isTrendingUp({values : marketData.close.reverse()}).then((results) => {
                    resolve({
                        'is_trending_up': results,
                    })
                })
            }),
            new Promise((resolve) => {
                if(marketData.close.length < 250) {
                    resolve()
                    return
                }

                technicalindicators.isTrendingDown({values : marketData.close.reverse()}).then((results) => {
                    resolve({
                        'is_trending_down': results,
                    })
                })
            }),
            new Promise((resolve) => {
                tulind.indicators.mfi.indicator([marketData.high, marketData.low, marketData.close, marketData.volume], [14], (err, results) => {
                    resolve({
                        'mfi': results[0][results[0].length-1],
                    })
                })
            }),
            new Promise((resolve) => {
                tulind.indicators.bbands.indicator([marketData.close], [20, 2], (err, results) => {
                    let bb = {
                        'lower': results[0][results[0].length - 1],
                        'middle': results[1][results[1].length - 1],
                        'upper': results[2][results[2].length - 1],
                    };

                    bb['pct'] = (bb['upper'] - bb['lower'] - 1) / bb['upper'] * 100;

                    resolve({'bollinger_bands': bb})
                })
            }),
            new Promise((resolve) => {
                if(marketData.close.length < 6) {
                    resolve()
                    return
                }

                let data = {
                    'open' : marketData.open.slice(0, 6).reverse(),
                    'high' : marketData.high.slice(0, 6).reverse(),
                    'close' : marketData.close.slice(0, 6).reverse(),
                    'low' : marketData.low.slice(0, 6).reverse(),
                };

                resolve({
                    'bullish': technicalindicators.bullish(data),
                    'bearish': technicalindicators.bearish(data),
                })
            }),
            new Promise((resolve) => {
                let top = lookbacks[0].high - Math.max(lookbacks[0].close, lookbacks[0].open)
                let bottom = lookbacks[0].low - Math.min(lookbacks[0].close, lookbacks[0].open)

                resolve({'wicked': {
                    'top': Math.abs(percent.calc(top, lookbacks[0].high - lookbacks[0].low, 2)),
                    'body': Math.abs(percent.calc(lookbacks[0].close - lookbacks[0].open, lookbacks[0].high - lookbacks[0].low, 2)),
                    'bottom': Math.abs(percent.calc(bottom, lookbacks[0].high - lookbacks[0].low, 2)),
                }})
            }),
        ]

        Promise.all(calculations).then((values) => {
            let results = {}

            values.forEach((value) => {
                for (let key in value) {
                   results[key] = value[key]
                }
            })

            cb(results)
        })
    },

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
     * @param lookbacks oldest first
     * @returns {Promise<any>}
     */
    getIndicatorsLookbacks: function (lookbacks) {
        return new Promise((resolve) => {

            let marketData = { open: [], close: [], high: [], low: [], volume: [] }

            // get last items
            let number = lookbacks.length - 1000;
            if(number < 0) {
                number = 0;
            }

            lookbacks.slice(number, 1000).forEach(function (lookback) {
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


