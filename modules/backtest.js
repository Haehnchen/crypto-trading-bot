'use strict';

const moment = require('moment');
const StrategyManager = require('./strategy/strategy_manager')

module.exports = class Backtest{
    constructor(candlestickRepository, instances, strategyManager) {
        this.candlestickRepository = candlestickRepository
        this.instances = instances
        this.strategyManager = strategyManager
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
            let start = Math.floor(moment().startOf('hour').subtract(hours, 'hours').toDate() / 1000) + 1
            let end = Math.floor(moment().toDate() / 1000)

            let rows = []

            let periodCache = {}

            let current = start

            let lastSignal = undefined

            while (current < end) {
                let item = {
                    'time': current
                };

                // mock repository for window selection of candles
                let mockedRepository = {
                    getLookbacksForPair: async (exchange, symbol, period) => {
                        return new Promise(async (resolve) => {
                            if (!periodCache[period]) {
                                periodCache[period] = await this.candlestickRepository.getLookbacksSince(exchange, symbol, period, start)
                            }

                            let filter = periodCache[period].slice().filter((candle) => {
                                return candle.time < current
                            });

                            resolve(filter)
                        })
                    }
                }

                let strategyManager = new StrategyManager(mockedRepository)

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

            let candles = (await this.candlestickRepository.getLookbacksSince(exchange, pair, options['period'], start)).map(candle => {
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
            })
        })
    }
};