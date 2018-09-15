'use strict';

module.exports = class Order {
    constructor(id, symbol, side, price, amount) {
        this.id = id
        this.symbol = symbol
        this.side = side
        this.price = price
        this.amount = amount
    }
};