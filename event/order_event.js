'use strict';

module.exports = class OrderEvent {
    constructor(exchange, symbol, order) {
        this.exchange = exchange;
        this.symbol = symbol;
        this.order = order;
    }
};