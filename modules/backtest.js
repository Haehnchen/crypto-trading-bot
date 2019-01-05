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

        return pairs
    }

    getBacktestStrategies() {
        return this.strategyManager.getStrategyNames()
    }

    getBacktestResult(tickInterval, hours, strategy, exchange, pair, options) {
        return new Promise(async (resolve) => {
            let start = moment()
                .startOf('hour')
                .subtract(hours * 60, 'minutes')
                .unix()

            // collect candles for cart and allow a prefill of eg 200 candles for our indicators starts
            let chartCandlePeriod = options['period'] || '15m';
            let prefillWindow = start - (Resample.convertPeriodToMinute(chartCandlePeriod) * 200 * 60)

            let rows = []
            let periodCache = {}
            let current = start
            let lastSignal = undefined

            let end = moment().unix()
            while (current < end) {
                let item = {
                    'time': current
                };

                // mock repository for window selection of candles
                let mockedRepository = {
                    fetchCombinedCandles: async (mainExchange, symbol, period, exchanges = []) => {
                        return new Promise(async (resolve) => {
                            if (!periodCache[period]) {
                                periodCache[period] = await this.exchangeCandleCombine.fetchCombinedCandlesSince(mainExchange, symbol, period, exchanges, prefillWindow)
                            }

                            let filter = {}
                            for (let ex in periodCache[period]) {
                                filter[ex] = periodCache[period][ex].slice().filter(candle => candle.time < current)
                            }

                            resolve(filter)
                        })
                    }
                }

                let strategyManager = new StrategyManager({}, mockedRepository)

                let backtestResult = await strategyManager.executeStrategyBacktest(strategy, exchange, pair, options, lastSignal)
                item['result'] = backtestResult

                // so change in signal
                if (backtestResult.signal === lastSignal) {
                    delete backtestResult.signal
                }

                if(['long', 'short'].includes(backtestResult.signal)) {
                    lastSignal = backtestResult.signal
                } else if(backtestResult.signal === 'close') {
                    lastSignal = undefined
                }

                rows.push(item)

                current += tickInterval;
            }

            let signals = rows.slice().filter(r => 'signal' in r.result)

            let dates = {}

            signals.forEach(signal => {
                if(!dates[signal.time]) {
                    dates[signal.time] = []
                }

                dates[signal.time].push(signal)
            })

            let candles = periodCache[chartCandlePeriod][exchange].filter(c => c.time > start).map(candle => {
                let signals = undefined

                for (let time in JSON.parse(JSON.stringify(dates))) {
                    if (time >= candle.time) {
                        signals = dates[time]
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
                    'period': chartCandlePeriod,
                }
            })
        })
    }
};