'use strict';

module.exports = class Position {
    constructor(symbol, side, amount, profit, updatedAt) {
        this.symbol = symbol
        this.side = side
        this.amount = amount
        this.profit = profit
        this.updatedAt = updatedAt
    }
};