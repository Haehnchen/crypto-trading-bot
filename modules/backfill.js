'use strict';

let moment = require('moment');
let ExchangeCandlestick = require('../dict/exchange_candlestick')
let _ = require('lodash')

module.exports = class Backfill {
    constructor(exchangesIterator, candleImporter) {
        this.exchangesIterator = exchangesIterator
        this.candleImporter = candleImporter
    }

    async backfill(exchangeName, symbol, period, date) {
        let exchange = this.exchangesIterator.find(e => e.getName() === exchangeName)
        if (!exchange) {
            throw 'Exchange not found: ' + exchangeName
        }

        let start = moment().subtract(date, 'days');
        let candles = undefined

        do {
            console.log('Since: ' + new Date(start).toISOString())
            candles = await exchange.backfill(symbol, period, start)

            let exchangeCandlesticks = candles.map(candle => {
                return ExchangeCandlestick.createFromCandle(exchangeName, symbol, period, candle)
            });

            await this.candleImporter.insertCandles(exchangeCandlesticks)

            console.log('Got: ' + candles.length + ' candles')

            start = _.max(candles.map(r => new Date(r.time * 1000)))
        } while (candles.length > 10);

        console.log('finish')
    }
};