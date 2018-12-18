'use strict';

let IndicatorBuilder = require('./dict/indicator_builder');
let IndicatorPeriod = require('./dict/indicator_period');
let ta = require('../../utils/technical_analysis');
var fs = require('fs');

module.exports = class StrategyManager {
    constructor(candlestickRepository) {
        this.candlestickRepository = candlestickRepository
        this.strategies = undefined
    }

    getStrategies() {
        if (this.strategies !== undefined) {
            return this.strategies
        }

        let strategies = []

        let dirs = [
            __dirname + '/strategies',
            __dirname + '/../../var/strategies',
        ]

        dirs.forEach((dir) => {
            if (!fs.existsSync(dir)) {
                return
            }

            fs.readdirSync(dir).forEach(file => {
                if (file.endsWith('.js')) {
                    strategies.push(new (require(dir + '/' + file.substr(0, file.length - 3)))())
                }
            })
        })

        return this.strategies = strategies
    }

    executeStrategy(strategyName, context, exchange, symbol, options) {
        options = options || {}

        let strategy = this.getStrategies().find((strategy) => {
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

            let indicatorPeriod = new IndicatorPeriod(context, results)

            let trigger = await strategy.period(indicatorPeriod, options)

            resolve(trigger)
        })
    }

    executeStrategyBacktest(strategyName, exchange, symbol, options) {
        options = options || {}

        let strategy = this.getStrategies().find((strategy) => {
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

            let trigger = await strategy.period(indicatorPeriod, options)

            trigger = trigger || {}

            trigger['price'] = price

            resolve(trigger)
        })
    }

    getStrategyNames() {
        return this.getStrategies().map(strategy => strategy.getName())
    }
}
