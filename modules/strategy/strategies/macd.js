'use strict';

let SignalResult = require('../dict/signal_result')

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
            indicatorPeriod.getLastSignal(),
        )
    }

    async macd(price, sma200Full, ema200Full, macdFull, lastSignal) {
        if (!macdFull || !ema200Full || macdFull.length < 2 || sma200Full.length < 2 || ema200Full.length < 2) {
            return
        }

        // remove incomplete candle
        let sma200 = sma200Full.slice(0, -1)
        let ema200 = ema200Full.slice(0, -1)
        let macd = macdFull.slice(0, -1)

        let debug = {
            'sma200': sma200.slice(-1)[0],
            'ema200': ema200.slice(-1)[0],
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
            return SignalResult.createSignal('close', 'debug')
        }

        // sma long
        let long = price >= sma200.slice(-1)[0]

        // ema long
        if (!long) {
            long = price >= ema200.slice(-1)[0]
        }

        if (long) {
            // long
            if(before < 0 && last > 0) {
                return SignalResult.createSignal('long', 'debug')
            }
        } else {
            // short

            if(before > 0 && last < 0) {
                return SignalResult.createSignal('short', 'debug')
            }
        }

        return SignalResult.createEmptySignal(debug)
    }

    getOptions() {
        return {
            'period': '15m',
        }
    }
}
