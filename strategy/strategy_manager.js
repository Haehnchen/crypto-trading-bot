'use strict';

let CCI = require('./cci');
let MACD = require('./macd');
let IndicatorBuilder = require('./dict/indicator_builder');
let IndicatorPeriod = require('./dict/indicator_period');
let ta = require('../utils/technical_analysis');

module.exports = class StrategyManager {
    constructor(candlestickRepository) {
        this.candlestickRepository = candlestickRepository

        this.strategies = [
            new CCI(),
            new MACD(),
        ];
    }

    executeStrategy(strategyName, price, exchange, symbol, options) {
        options = options || {}

        let strategy = this.strategies.find((strategy) => {
            return strategy.getName() === strategyName
        })

        if (!strategy) {
            throw 'invalid strategy: ' + strategy
        }

        return new Promise(async (resolve) => {
            let indicatorBuilder = new IndicatorBuilder()
            strategy.buildIndicator(indicatorBuilder, options)

            let periodGroups = {}

            indicatorBuilder.all().forEach((indicator) => {
                if (!periodGroups[indicator.period]) {
                    periodGroups[indicator.period] = []
                }

                periodGroups[indicator.period].push(indicator)
            });

            var results = {};

            for (let k in periodGroups) {
                let periodGroup = periodGroups[k];

                let result = await ta.createIndicatorsLookback(
                    (await this.candlestickRepository.getLookbacksForPair(exchange, symbol, k)).slice().reverse(),
                    periodGroup
                )

                // array merge
                for (let x in result) {
                    results[x] = result[x]
                }
            }

            let indicatorPeriod = new IndicatorPeriod(price, results)

            let trigger = await strategy.period(indicatorPeriod)

            resolve(trigger)
        })
    }

    executeStrategyBacktest(strategyName, exchange, symbol, options) {
        options = options || {}

        let strategy = this.strategies.find((strategy) => {
            return strategy.getName() === strategyName
        })

        if (!strategy) {
            throw 'invalid strategy: ' + strategy
        }

        return new Promise(async (resolve) => {
            let indicatorBuilder = new IndicatorBuilder()
            strategy.buildIndicator(indicatorBuilder, options)

            let periodGroups = {}

            indicatorBuilder.all().forEach((indicator) => {
                if (!periodGroups[indicator.period]) {
                    periodGroups[indicator.period] = []
                }

                periodGroups[indicator.period].push(indicator)
            });

            var results = {};

            var price = undefined

            for (let k in periodGroups) {
                let periodGroup = periodGroups[k];

                let lookbacks = (await this.candlestickRepository.getLookbacksForPair(exchange, symbol, k)).slice().reverse()

                if (lookbacks.length > 0) {
                    price = lookbacks[lookbacks.length - 1].close
                }

                let result = await ta.createIndicatorsLookback(
                    lookbacks,
                    periodGroup
                )

                // array merge
                for (let x in result) {
                    results[x] = result[x]
                }
            }

            let indicatorPeriod = new IndicatorPeriod(price, results)

            let trigger = await strategy.period(indicatorPeriod)

            trigger = trigger || {}

            trigger['price'] = price

            resolve(trigger)
        })
    }

    getStrategyNames() {
        return this.strategies.map(strategy => strategy.getName())
    }
}
