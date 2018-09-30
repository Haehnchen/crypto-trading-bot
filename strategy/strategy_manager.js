'use strict';

let CCI = require('./cci');
let IndicatorBuilder = require('./dict/indicator_builder');
let IndicatorPeriod = require('./dict/indicator_period');
let ta = require('../utils/technical_analysis');

module.exports = class StrategyManager {
    constructor(db) {
        this.db = db

        this.strategies = [
            new CCI(),
        ];
    }

    executeStrategy(strategyName, price, lookbacks) {
        let strategy = this.strategies.find((strategy) => {
            return strategy.getName() === strategyName
        })

        if (!strategy) {
            throw 'invalid strategy: ' + strategy
        }

        return new Promise(async (resolve) => {
            let indicatorBuilder = new IndicatorBuilder()

            strategy.buildIndicator(indicatorBuilder)

            let result = await ta.createIndicatorsLookback(lookbacks, indicatorBuilder.all())

            let indicatorPeriod = new IndicatorPeriod(price, result)
            let trigger = await strategy.period(indicatorPeriod)

            resolve(trigger)
        })
    }
}
