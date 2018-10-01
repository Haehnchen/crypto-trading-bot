'use strict';

let strategy = require('./collection');

module.exports = class MACD {
    constructor() {
        this.candles = [];
    }

    getName() {
        return 'macd'
    }

    buildIndicator(indicatorBuilder) {
        indicatorBuilder.add('macd' , 'macd')

        indicatorBuilder.add('sma200', 'sma', {
            'length': 200,
        })

        indicatorBuilder.add('ema200', 'ema', {
            'length': 200,
        })
    }

    period(indicatorPeriod) {
        return strategy.macd(
            indicatorPeriod.getPrice(),
            indicatorPeriod.getIndicator('sma200'),
            indicatorPeriod.getIndicator('ema200'),
            indicatorPeriod.getIndicator('macd'),
        )
    }
}
