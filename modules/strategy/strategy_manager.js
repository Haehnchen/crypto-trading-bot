'use strict';

let IndicatorBuilder = require('./dict/indicator_builder')
let IndicatorPeriod = require('./dict/indicator_period')
let ta = require('../../utils/technical_analysis')
let fs = require('fs');
const StrategyContext = require('../../dict/strategy_context')
const Ticker = require('../../dict/ticker')

module.exports = class StrategyManager {
    constructor(candlestickRepository, technicalAnalysisValidator, logger) {
        this.candlestickRepository = candlestickRepository
        this.technicalAnalysisValidator = technicalAnalysisValidator

        this.logger = logger
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

            for (let period in periodGroups) {
                let periodGroup = periodGroups[period];

                let lookbackNewestFirst = (await this.candlestickRepository.getLookbacksForPair(exchange, symbol, period)).slice()
                let lookbacks = lookbackNewestFirst.slice().reverse()

                // check if candle to close time is outside our allow time window
                if (!this.technicalAnalysisValidator.isValidCandleStickLookback(lookbackNewestFirst, period)) {
                    // too noisy for now; @TODO provide a logging throttle
                    // this.logger.error('Outdated candle stick period detected: ' + JSON.stringify([period, strategyName, exchange, symbol]))

                    // stop current run
                    resolve()
                    return
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

            let indicatorPeriod = new IndicatorPeriod(context, results)

            let trigger = await strategy.period(indicatorPeriod, options)

            resolve(trigger)
        })
    }

    executeStrategyBacktest(strategyName, exchange, symbol, options, lastSignal) {
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

            let context = StrategyContext.create(new Ticker(exchange, symbol, undefined, price, price))
            context.lastSignal = lastSignal

            let indicatorPeriod = new IndicatorPeriod(context, results)

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
