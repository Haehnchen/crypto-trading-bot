'use strict';

module.exports = class MacdExt {
    getName() {
        return 'macd_ext'
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options['period']) {
            throw 'Invalid period'
        }

        indicatorBuilder.add('macd', 'macd_ext', options['period'], options)

        indicatorBuilder.add('sma200', 'sma', options['period'], {
            'length': 200,
        })
    }

    period(indicatorPeriod) {
        return this.macd(
            indicatorPeriod.getPrice(),
            indicatorPeriod.getIndicator('sma200'),
            indicatorPeriod.getIndicator('macd'),
            indicatorPeriod.getLastSignal(),
        )
    }

    macd(price, sma200Full, macdFull, lastSignal) {
        return new Promise(async (resolve) => {
            if (macdFull.length <= 0) {
                resolve()
                return
            }

            // remove incomplete candle
            let sma200 = sma200Full.slice(0, -1)
            let macd = macdFull.slice(0, -1)

            let debug = {
                'sma200': sma200.slice(-1)[0],
                'histogram': macd.slice(-1)[0].histogram,
                'last_signal': lastSignal,
            }

            let before = macd.slice(-2)[0].histogram
            let last = macd.slice(-1)[0].histogram

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
}
