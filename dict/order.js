'use strict';

module.exports = class Order {
    constructor(id, symbol, side, price, amount, type) {
        this.id = id
        this.symbol = symbol
        this.side = side
        this.price = price
        this.amount = amount
        this.type = type
    }

    static createMarketOrder(symbol, side, amount) {
        if(side !== 'long' && side !== 'short') {
            throw 'Invalid order side:' + side;
        }

        return new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            symbol,
            side,
            side === 'long' ? 1 : -1,
            amount,
            'market'
        );
    }
};