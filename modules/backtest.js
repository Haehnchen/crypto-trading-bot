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
                    if (!periodCache[period]) {
                        periodCache[period] = await this.exchangeCandleCombine.fetchCombinedCandlesSince(mainExchange, symbol, period, exchanges, prefillWindow)
                    }

                    let filter = {}
                    for (let ex in periodCache[period]) {
                        filter[ex] = periodCache[period][ex].slice().filter(candle => candle.time < current)
                    }

                    return filter
                }
            }

            let end = moment().unix()
            while (current < end) {
                let item = {
                    'time': current
                };

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

                current += tickIntervalInMinutes * 60;
            }

            let signals = rows.slice().filter(r => 'signal' in r.result)

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
                    'period': candlePeriod,
                }
            })
        })
    }
};