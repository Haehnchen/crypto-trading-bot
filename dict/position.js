'use strict';

module.exports = class Position {
    constructor(symbol, side, amount, updatedAt) {
        this.symbol = symbol
        this.side = side
        this.amount = amount
        this.updatedAt = updatedAt
    }
};