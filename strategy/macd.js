'use strict';

module.exports = class MACD {
    getName() {
        return 'macd'
    }

    buildIndicator(indicatorBuilder, options) {
        if (!options['period']) {
            throw 'Invalid period'
        }

        indicatorBuilder.add('macd', 'macd', options['period'])

        indicatorBuilder.add('sma200', 'sma', options['period'], {
            'length': 200,
        })

        indicatorBuilder.add('ema200', 'ema', options['period'], {
            'length': 200,
        })
    }

    period(indicatorPeriod) {
        return this.macd(
            indicatorPeriod.getPrice(),
            indicatorPeriod.getIndicator('sma200'),
            indicatorPeriod.getIndicator('ema200'),
            indicatorPeriod.getIndicator('macd'),
        )
    }

    macd(price, sma200, ema200, macd) {
        return new Promise(async (resolve) => {
            let debug = {
                'sma200': sma200.slice(-1)[0],
                'ema200': ema200.slice(-1)[0],
                'histogram': macd.slice(-1)[0].histogram,
            }

            let before = macd.slice(-2)[0].histogram
            let last = macd.slice(-1)[0].histogram

            // sma long

            let long = price >= sma200.slice(-1)[0]

            // ema long
            if (!long) {
                long = price >= ema200.slice(-1)[0]
            }

            if (long) {
                // long
                if(before < 0 && last > 0) {
                    resolve({
                        'signal': 'long',
                        'debug': debug
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

            resolve(debug)
        })
    }
}
