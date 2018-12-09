'use strict';

module.exports = class Order {
    constructor(id, symbol, side, price, amount, type, options = {}) {
        if(side !== 'long' && side !== 'short') {
            throw 'Invalid order side:' + side;
        }

        this.id = id
        this.symbol = symbol
        this.side = side
        this.price = price
        this.amount = amount
        this.type = type,
        this.options = options
    }

    static createMarketOrder(symbol, side, amount) {
        return new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            symbol,
            side,
            side === 'long' ? 1 : -1,
            amount,
            'market'
        );
    }

    static createLimitPostOnlyOrder(symbol, side, price, amount) {
        return new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            symbol,
            side,
            price,
            amount,
            'limit',
            {
                'postOnly': true,
            }
        )
    }
};