'use strict';

let strategy = require('./collection');

module.exports = class CCI {
    constructor() {
        this.candles = [];
    }

    getName() {
        return 'cci'
    }

    buildIndicator(indicatorBuilder) {
        indicatorBuilder.add('cci' , 'cci')

        indicatorBuilder.add('sma200', 'sma', {
            'length': 200,
        })

        indicatorBuilder.add('ema200', 'ema', {
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
