'use strict';

let ExchangeCandlestick = require('../../dict/exchange_candlestick')

module.exports = class CandleStickListener {
    constructor(candleImporter) {
        this.candleImporter = candleImporter
    }

    onCandleStick(candleStickEvent) {
        return this.candleImporter.insertThrottledCandles(candleStickEvent.candles.map(candle => {
            return ExchangeCandlestick.createFromCandle(
                candleStickEvent.exchange,
                candleStickEvent.symbol,
                candleStickEvent.period,
                candle
            )
        }))
    }
};