'use strict';

module.exports = class Ticker {
    constructor(exchange, symbol, time, bid, ask) {
        this.exchange = exchange;
        this.symbol = symbol;
        this.time = time;
        this.bid = bid;
        this.ask = ask;
    }
};