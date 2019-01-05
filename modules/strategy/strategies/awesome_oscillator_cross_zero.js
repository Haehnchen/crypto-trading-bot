'use strict';

module.exports = class AwesomeOscillatorCrossZero {
    getName() {
        return 'awesome_oscillator_cross_zero'
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options['period']) {
            throw 'Invalid period'
        }

        indicatorBuilder.add('ao', 'ao', options['period'], options)

        indicatorBuilder.add('sma200', 'sma', options['period'], {
            'length': 200,
        })
    }

    period(indicatorPeriod) {
        return this.macd(
            indicatorPeriod.getPrice(),
            indicatorPeriod.getIndicator('sma200'),
            indicatorPeriod.getIndicator('ao'),
            indicatorPeriod.getLastSignal(),
        )
    }

    macd(price, sma200Full, aoFull, lastSignal) {
        return new Promise(async (resolve) => {
            if (aoFull.length <= 2 || sma200Full.length < 2) {
                resolve()
                return
            }

            // remove incomplete candle
            let sma200 = sma200Full.slice(0, -1)
            let ao = aoFull.slice(0, -1)

            let debug = {
                'sma200': sma200.slice(-1)[0],
                'ao': ao.slice(-1)[0],
                'last_signal': lastSignal,
            }

            let before = ao.slice(-2)[0]
            let last = ao.slice(-1)[0]

            // trend change
            if (
                (lastSignal === 'long' && before > 0 && last < 0)
                || (lastSignal === 'short' && before < 0 && last > 0)
            ) {
                resolve({
                    'signal': 'close',
                    'debug': debug,
                })

                return
            }

            // sma long
            let long = price >= sma200.slice(-1)[0]

            if (long) {
                // long
                if(before < 0 && last > 0) {
                    resolve({
                        'signal': 'long',
                        'debug': debug,
                    })
                }
            } else {
                // short

                if(before > 0 && last < 0) {
                    resolve({
                        'signal': 'short',
                        'debug': debug
                    })
                }
            }

            resolve({'debug': debug})
        })
    }

    getOptions() {
        return {
            'period': '15m',
        }
    }
}
