'use strict';

module.exports = class ExchangeCandlestick {
    constructor(exchange, period, symbol, time, open, high, low, close, volume) {
        this.exchange = exchange;
        this.period = period;
        this.symbol = symbol;
        this.time = time;
        this.open = open;
        this.high = high;
        this.low = low;
        this.close = close;
        this.volume = volume;
    }

    static createFromCandle(exchange, symbol, period, candle) {
        return new ExchangeCandlestick(
            exchange,
            period,
            symbol,
            candle.time,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume,
        )
    }
};
