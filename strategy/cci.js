'use strict';

let strategy = require('./collection');

module.exports = class CCI {
    constructor() {
        this.candles = [];
    }

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
        return strategy.cci(
            indicatorPeriod.getPrice(),
            indicatorPeriod.getIndicator('sma200'),
            indicatorPeriod.getIndicator('ema200'),
            indicatorPeriod.getIndicator('cci'),
        )
    }
}
