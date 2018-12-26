'use strict';

var moment = require('moment');
let CandlestickEvent = require('../event/candlestick_event')
var _ = require('lodash')

module.exports = class Backfill {
    constructor(exchangesIterator, candleStickListener) {
        this.exchangesIterator = exchangesIterator
        this.candleStickListener = candleStickListener
    }

    async backfill(exchangeName, symbol, period, date) {
        let exchange = this.exchangesIterator.find(e => e.getName() === exchangeName)
        if (!exchange) {
            throw 'Exchange not found: ' + exchangeName
        }

        let start = moment().subtract(date, 'days');
        let results = undefined

        do {
            console.log('Since: ' + start)
            results = await exchange.backfill(symbol, period, start)

            let event = new CandlestickEvent(exchangeName, symbol, period, results)

            await this.candleStickListener.onCandleStick(event)

            console.log('Got: ' + results.length)

            start = _.max(results.map(r => new Date(r.time * 1000)))
        } while (results.length > 10);
    }
};