const tulind = require('tulind');
const technicalindicators = require('technicalindicators');

module.exports = {
    getIndicatorsForCandleLookbackPeriod: function (lookbacks, cb) {
        let marketData = { open: [], close: [], high: [], low: [], volume: [] }

        lookbacks.slice(0, 1000).reverse().forEach(function (lookback) {
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
                    resolve({
                        'macd': results[0][results[0].length-1],
                    })
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
}


