'use strict';

module.exports = class Position {
    constructor(symbol, side, amount) {
        this.symbol = symbol
        this.side = side
        this.amount = amount
    }
};