'use strict';

let _ = require('lodash')

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

    hasAdjustedPrice() {
        return this.options.adjust_price === true
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

    static createLimitPostOnlyOrder(symbol, side, price, amount, options) {
        return new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            symbol,
            side,
            price,
            amount,
            'limit',
            _.merge(options, {
                'post_only': true,
            })
        )
    }

    static createLimitPostOnlyOrderAutoAdjustedPriceOrder(symbol, side, amount) {
        return Order.createLimitPostOnlyOrder(symbol, side, undefined, amount, {
            'adjust_price': true,
        })
    }

    static createRetryOrder(order) {
        return new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            order.symbol,
            order.side,
            order.price,
            order.amount,
            order.type,
            order.options,
        )
    }

    static createRetryOrderWithPriceAdjustment(order, price) {
        return new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            order.symbol,
            order.side,
            price,
            order.amount,
            order.type,
            order.options,
        )
    }
};