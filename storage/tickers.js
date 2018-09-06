'use strict';

module.exports = class Tickers {
    constructor() {
        this.tickers = {};
    }

    set(ticker) {
        this.tickers[ticker.exchange + '.' + ticker.symbol] = ticker
    }

    get(exchange, symbol) {
        return this.tickers[exchange + '.' + symbol] || null
    }

    all() {
        return this.tickers
    }
}
