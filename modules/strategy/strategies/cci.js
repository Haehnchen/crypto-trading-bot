'use strict';

module.exports = class CCI {
    getName() {
        return 'cci'
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options['period']) {
            throw 'Invalid period'
        }

        indicatorBuilder.add('cci', 'cci', options['period'])

        indicatorBuilder.add('sma200', 'sma', options['period'], {
            'length': 200,
        })

        indicatorBuilder.add('ema200', 'ema', options['period'], {
            'length': 200,
        })
    }

    period(indicatorPeriod) {
        return this.cci(
            indicatorPeriod.getPrice(),
            indicatorPeriod.getIndicator('sma200'),
            indicatorPeriod.getIndicator('ema200'),
            indicatorPeriod.getIndicator('cci'),
            indicatorPeriod.getLastSignal(),
        )
    }

    cci(price, sma200Full, ema200Full, cciFull, lastSignal) {
        return new Promise(async (resolve) => {
            if (cciFull.length <= 0 || sma200Full.length < 2  || ema200Full.length < 2) {
                resolve()
                return
            }

            // remove incomplete candle
            let sma200 = sma200Full.slice(0, -1)
            let ema200 = ema200Full.slice(0, -1)
            let cci = cciFull.slice(0, -1)

            let debug = {
                'sma200': sma200.slice(-1)[0],
                'ema200': ema200.slice(-1)[0],
                'cci': cci.slice(-1)[0],
            }

            let before = cci.slice(-2)[0]
            let last = cci.slice(-1)[0]

            // trend change
            if (
                (lastSignal === 'long' && before > 100 && last < 100)
                || (lastSignal === 'short' && before < -100 && last > -100)
            ) {
                resolve({
                    'signal': 'close',
                    'debug': debug,
                })

                return
            }

            let long = price >= sma200.slice(-1)[0]

            // ema long
            if (!long) {
                long = price >= ema200.slice(-1)[0]
            }

            let count = cci.length - 1

            if (long) {
                // long

                if(before <= -100 && last >= -100) {
                    let rangeValues = []

                    for (let i = count - 1; i >= 0; i--) {
                        if (cci[i] >= -100){
                            rangeValues = cci.slice(i, count)
                            break;
                        }
                    }

                    let min = Math.min(...rangeValues);
                    if(min <= -200) {
                        resolve({
                            'signal': 'long',
                            '_trigger': min,
                            'debug': debug
                        })
                    }
                }

            } else {
                if(before >= 100 && last <= 100) {
                    let count = cci.length - 1
                    let rangeValues = []

                    for (let i = count - 1; i >= 0; i--) {
                        if (cci[i] <= 100){
                            rangeValues = cci.slice(i, count)
                            break;
                        }
                    }

                    let max = Math.max(...rangeValues);
                    if(max >= 200) {
                        resolve({
                            'signal': 'short',
                            '_trigger': max,
                            'debug': debug
                        })
                    }
                }
            }

            resolve({'debug': debug})

        })
    }

    getBacktestColumns() {
        return [
            {
                'label': 'cci',
                'value': 'cci',
                'type': 'oscillator',
                'range': [100, -100],
            },
        ]
    }
}
