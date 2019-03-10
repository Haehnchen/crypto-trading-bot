'use strict';

const moment = require('moment');
const StrategyManager = require('./strategy/strategy_manager')
const Resample = require('../utils/resample')
const _ = require('lodash')

module.exports = class Backtest {
    constructor(instances, strategyManager, exchangeCandleCombine) {
        this.instances = instances
        this.strategyManager = strategyManager
        this.exchangeCandleCombine = exchangeCandleCombine
    }

    getBacktestPairs() {
        let pairs = []

        this.instances['symbols'].forEach((symbol) => {
            pairs.push(symbol.exchange + '.' + symbol.symbol)
        })

        return pairs.sort()
    }

    getBacktestStrategies() {
        return this.strategyManager.getStrategies().map(strategy => { return {
            'name': strategy.getName(),
            'options': typeof strategy.getOptions !== "undefined" ? strategy.getOptions() : undefined,
        }})
    }

    getBacktestResult(tickIntervalInMinutes, hours, strategy, candlePeriod, exchange, pair, options) {
        return new Promise(async (resolve) => {
            let start = moment()
                .startOf('hour')
                .subtract(hours * 60, 'minutes')
                .unix()

            // collect candles for cart and allow a prefill of eg 200 candles for our indicators starts

            let rows = []
            let current = start
            let lastSignal = undefined

            // mock repository for window selection of candles
            let periodCache = {}
            let prefillWindow = start - (Resample.convertPeriodToMinute(candlePeriod) * 200 * 60)
            let mockedRepository = {
                fetchCombinedCandles: async (mainExchange, symbol, period, exchanges = []) => {
                    let key = mainExchange + symbol + period;
                    if (!periodCache[key]) {
                        periodCache[key] = await this.exchangeCandleCombine.fetchCombinedCandlesSince(mainExchange, symbol, period, exchanges, prefillWindow)
                    }

                    let filter = {}
                    for (let ex in periodCache[key]) {
                        filter[ex] = periodCache[key][ex].slice().filter(candle => candle.time < current)
                    }

                    return filter
                }
            }

            let end = moment().unix()
            while (current < end) {
                let strategyManager = new StrategyManager({}, mockedRepository)

                let item = await strategyManager.executeStrategyBacktest(strategy, exchange, pair, options, lastSignal)
                item['time'] = current

                // so change in signal
                let currentSignal = item.result ? item.result.getSignal() : undefined
                if (currentSignal === lastSignal) {
                    currentSignal = undefined
                }

                if (['long', 'short'].includes(currentSignal)) {
                    lastSignal = currentSignal
                } else if(currentSignal === 'close') {
                    lastSignal = undefined
                }

                rows.push(item)

                current += (tickIntervalInMinutes * 60);
            }

            let signals = rows.slice().filter(r => r.result && r.result.getSignal())

            let dates = {}

            signals.forEach(signal => {
                if(!dates[signal.time]) {
                    dates[signal.time] = []
                }

                dates[signal.time].push(signal)
            })

            let exchangeCandles = await mockedRepository.fetchCombinedCandles(exchange, pair, candlePeriod)
            let candles = exchangeCandles[exchange].filter(c => c.time > start).map(candle => {
                let signals = undefined

                for (let time in JSON.parse(JSON.stringify(dates))) {
                    if (time >= candle.time) {
                        signals = dates[time].map(i => {
                            return {
                                'signal': i.result.getSignal(),
                            }
                        })
                        delete dates[time]
                    }
                }

                return {
                    date: new Date(candle.time * 1000),
                    open: candle.open,
                    high: candle.high,
                    low: candle.low,
                    close: candle.close,
                    volume: candle.volume,
                    signals: signals,
                }
            })

            resolve({
                'rows': rows.slice().reverse(),
                'signals': signals.slice().reverse(),
                'candles': JSON.stringify(candles),
                'extra_fields': this.strategyManager.getBacktestColumns(strategy),
                'configuration': {
                    'exchange': exchange,
                    'symbol': pair,
                    'period': candlePeriod,
                }
            })
        })
    }
};