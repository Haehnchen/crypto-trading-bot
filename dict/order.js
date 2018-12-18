'use strict';

let _ = require('lodash')

module.exports = class Order {
    constructor(id, symbol, side, price, amount, type, options = {}) {
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

    static createLimitPostOnlyOrder(symbol, side, price, amount, options) {
        if(side !== 'long' && side !== 'short') {
            throw 'Invalid order side:' + side;
        }

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

    static createLimitPostOnlyOrderAutoSide(symbol, price, amount, options) {
        return new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            symbol,
            price < 0 ? 'short' : 'long',
            price,
            amount,
            'limit',
            _.merge(options, {
                'post_only': true,
            })
        )
    }

    static createLimitPostOnlyOrderAutoAdjustedPriceOrder(symbol, side, amount, options = {}) {
        if(side !== 'long' && side !== 'short') {
            throw 'Invalid order side:' + side;
        }

        return Order.createLimitPostOnlyOrder(symbol, side, undefined, amount,  _.merge(options, {
            'adjust_price': true,
        }))
    }

    static createRetryOrder(order) {
        if(order.side !== 'long' && order.side !== 'short') {
            throw 'Invalid order side:' + order.side;
        }

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
        if(order.side !== 'long' && order.side !== 'short') {
            throw 'Invalid order side:' + order.side;
        }

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

    static createPriceUpdateOrder(id, price) {
        return new Order(
            id,
            undefined,
            undefined,
            price,
            undefined,
            undefined,
            undefined,
        )
    }

    static createStopLossOrder(symbol, price, amount) {
        return new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            symbol,
            undefined,
            price,
            amount,
            'stop',
            {'close': true},
        )
    }

    static createCloseOrderWithPriceAdjustment(symbol, amount) {
        return Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder(
            symbol,
            amount < 0 ? 'short' : 'long',
            amount,
            {'close': true},
        )
    }
};