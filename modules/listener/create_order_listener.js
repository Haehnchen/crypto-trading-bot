'use strict';

let Candlestick = require('../../dict/candlestick.js');
let ta = require('../../utils/technical_analysis');

module.exports = class CreateOrderListener {
    constructor(exchanges, logger) {
        this.exchanges = exchanges
        this.logger = logger
    }

    onCreateOrder(orderEvent) {
        this.logger.debug('Create Order:' + JSON.stringify(orderEvent))

        if (!this.exchanges[orderEvent.exchange]) {
            console.log('order: unknown exchange:' + orderEvent.exchange)
            return
        }

        let exchange = this.exchanges[orderEvent.exchange]

        let ordersForSymbol = exchange.getOrdersForSymbol(orderEvent.symbol);

        if (ordersForSymbol.length === 0) {
            exchange.order(orderEvent.symbol, orderEvent.order).then((order) => {
                console.log(order)
            }).catch(() => {
                console.log('error')
            })

            return
        }

        logger.debug('Info Order update:' + JSON.stringify(orderEvent))

        let currentOrder = ordersForSymbol[0];

        if (currentOrder.side !== orderEvent.order.side) {
            console.log('order side change')
            return
        }

        exchange.updateOrder(currentOrder.id, orderEvent.order).then((order) => {
            console.log(order)
        }).catch(() => {
            console.log('error')
        })
    }
};