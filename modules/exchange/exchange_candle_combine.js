'use strict';

let Candlestick = require('../../dict/candlestick')

module.exports = class ExchangeCandleCombine {
    constructor(candlestickRepository) {
        this.candlestickRepository = candlestickRepository
    }

    async fetchCombinedCandles(mainExchange, symbol, period, exchanges = []) {
        return this.combinedCandles(
            this.candlestickRepository.getLookbacksForPair(mainExchange, symbol, period),
            mainExchange,
            symbol,
            period,
            exchanges
        )
    }

    async fetchCombinedCandlesSince(mainExchange, symbol, period, exchanges = [], start) {
        return this.combinedCandles(
            this.candlestickRepository.getLookbacksSince(mainExchange, symbol, period, start),
            mainExchange,
            symbol,
            period,
            exchanges
        )
    }

    async combinedCandles(candlesAwait, mainExchange, symbol, period, exchanges = []) {
        let currentTime = Math.round((new Date()).getTime() / 1000)

        // we filter the current candle, be to able to use it later
        let candles = (await candlesAwait).filter(c => c.time <= currentTime)

        let result = {
            [mainExchange]: candles,
        }

        // no need for overhead
        if (exchanges.length === 0 || candles.length === 0) {
            return result
        }

        let c = {
            [mainExchange]: {},
        }

        candles.forEach(candle => {
            c[mainExchange][candle.time] = candle
        })

        let start = candles[candles.length - 1].time

        await Promise.all(exchanges.map(exchange => {
            return new Promise(async resolve => {
                let candles = {}

                let databaseCandles = await this.candlestickRepository.getLookbacksSince(exchange.name, exchange.symbol, period, start);
                databaseCandles.forEach(c => {
                    candles[c.time] = c
                })

                let myCandles = []

                let timeMatchedOnce = false
                for (let time of Object.keys(c[mainExchange])) {
                    // time was matched
                    if (candles[time]) {
                        myCandles.push(candles[time])
                        timeMatchedOnce = true
                        continue
                    }

                    // pipe the close prices from last known candle
                    let previousCandle = myCandles[myCandles.length - 1]

                    let candle = previousCandle
                        ? new Candlestick(parseInt(time), previousCandle.close, previousCandle.close, previousCandle.close, previousCandle.close, 0)
                        : new Candlestick(parseInt(time))

                    myCandles.push(candle)
                }

                if (timeMatchedOnce) {
                    result[exchange.name + exchange.symbol] = myCandles.reverse()
                }

                resolve()
            })
        }))

        return result
    }
}
