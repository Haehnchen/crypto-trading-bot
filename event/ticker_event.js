'use strict';

module.exports = class TickerEvent {
    constructor(exchange, symbol, price) {
        this.exchange = exchange;
        this.symbol = symbol;
        this.price = price;
    }
};