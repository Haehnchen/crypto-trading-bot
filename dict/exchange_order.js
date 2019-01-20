'use strict';

module.exports = class ExchangeOrder {
    constructor(id, symbol, status, price, amount, retry, ourId, side, type, createdAt, updatedAt, raw = undefined) {
        if (side !== 'buy' && side !== 'sell') {
            throw 'Invalid order direction given:' + side
        }

        this.id = id
        this.symbol = symbol
        this.status = status
        this.price = price
        this.amount = amount
        this.retry = retry
        this.ourId = ourId
        this.side = side
        this.type = type
        this.createdAt = createdAt
        this.updatedAt = updatedAt
        this.raw = raw
    }

    static createBlankRetryOrder(side) {
        return new ExchangeOrder(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            undefined,
            'canceled',
            undefined,
            undefined,
            true,
            undefined,
            side,
            undefined,
            new Date(),
            new Date(),
        )
    }

    static createCanceled(order) {
        return new ExchangeOrder(
            order.id,
            order.symbol,
            'canceled',
            order.price,
            order.amount,
            false,
            order.ourId,
            order.side,
            order.type,
            order.createdAt,
            order.updatedAt,
            order.raw,
        )
    }
}