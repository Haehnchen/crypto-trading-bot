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

        // filter same direction
        let ordersForSymbol = exchange.getOrdersForSymbol(orderEvent.order.symbol).filter((order) => {
            return order.side === orderEvent.order.side
        })

        if (ordersForSymbol.length === 0) {
            this.triggerOrder(exchange, orderEvent.order)
            return
        }

        this.logger.debug('Info Order update:' + JSON.stringify(orderEvent))

        let currentOrder = ordersForSymbol[0];

        if (currentOrder.side !== orderEvent.order.side) {
            console.log('order side change')
            return
        }

        exchange.updateOrder(currentOrder.id, orderEvent.order).then((order) => {
            console.log(order)
        }).catch(() => {
            console.log('order update error')
        })
    }

    triggerOrder(exchange, order, retry = 0) {
        if(retry > 3) {
            console.log('Retry limit stop creating order: ' + JSON.stringify(order))
            return
        }

        if (retry > 0) {
            console.log('Retry (' + retry + ') creating order: ' + JSON.stringify(order))
        }

        exchange.order(order).then((order) => {
            if(order.status === 'rejected') {
                setTimeout(() => {
                    console.log('Order rejected: ' + JSON.stringify(order))
                    this.triggerOrder(exchange, order, retry + 1)
                }, 1500);

                return
            }

            console.log('Order created: ' + JSON.stringify(order))
        }).catch((e) => {
            console.log(e)
            console.log('Order create error: ' + JSON.stringify(e) + ' - ' + JSON.stringify(order))
        })
    }
};