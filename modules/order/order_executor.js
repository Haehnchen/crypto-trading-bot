'use strict';

const Order = require('../../dict/order')
const _ = require('lodash')
const moment = require('moment')

module.exports = class OrderExecutor {
    constructor(exchangeManager, tickers, systemUtil, logger) {
        this.exchangeManager = exchangeManager
        this.tickers = tickers
        this.logger = logger
        this.systemUtil = systemUtil
        this.runningOrders = {}

        this.orders = []
    }

    /**
     * Keep open orders in orderbook at first position
     */
    adjustOpenOrdersPrice() {
        let orders = this.orders.filter(order =>
            order.order.hasAdjustedPrice()
        )

        // cleanup
        for (let orderId in this.runningOrders) {
            if (this.runningOrders[orderId] < moment().subtract(30, 'minutes')) {
                delete this.runningOrders[orderId]
            }
        }

        let visitExchangeOrder = async order => {
            if (order.id in this.runningOrders) {
                this.logger.info('OrderAdjust: already running: ' + JSON.stringify([order.id, order.exchange, order.symbol]))
                return
            }

            this.runningOrders[order.id] = new Date()

            let exchange = this.exchangeManager.get(order.exchange)
            if (!exchange) {
                console.error('OrderAdjust: Invalid exchange:' + order.exchange)
                delete this.runningOrders[order.id]

                return
            }

            // order not known by exchange cleanup
            let lastExchangeOrder = await exchange.findOrderById(order.id);
            if (!lastExchangeOrder || lastExchangeOrder.status !== 'open') {
                this.logger.info('OrderAdjust: Unknown order cleanup: ' + JSON.stringify([order.exchangeOrder.id]))

                // async issues? we are faster then exchange; even in high load: implement a global order management
                // and filter out executed order (eg LIMIT order process)
                this.orders = this.orders.filter(myOrder =>
                    myOrder.id !== order.id
                )

                delete this.runningOrders[order.id]

                return
            }

            let price = await this.getCurrentPrice(order.exchange, order.order.symbol, order.order.side)
            let orderUpdate = Order.createPriceUpdateOrder(order.exchangeOrder.id, price)

            // normalize prices for positions compare; we can have negative prices depending on "side"
            if (Math.abs(lastExchangeOrder.price) === Math.abs(price)) {
                this.logger.info('OrderAdjust: No price update needed:' + JSON.stringify([lastExchangeOrder.id, Math.abs(lastExchangeOrder.price), Math.abs(price), order.exchange, order.symbol]))
                delete this.runningOrders[order.id]

                return
            }

            try {
                let updatedOrder = await exchange.updateOrder(orderUpdate.id, orderUpdate)

                if (updatedOrder.status === 'open') {
                    this.logger.info('OrderAdjust: Order adjusted with orderbook price: ' + JSON.stringify([updatedOrder.id, Math.abs(lastExchangeOrder.price), Math.abs(price), order.exchange, order.symbol]))
                } else if(updatedOrder.status === 'canceled' && updatedOrder.retry === true) {
                    // we update the price outside the orderbook price range on PostOnly we will cancel the order directly
                    this.logger.error('OrderAdjust: Updated order canceled: ' + JSON.stringify(order))
                    // @TODO: recreate order?
                } else {
                    this.logger.error('OrderAdjust: Unknown order state: ' + JSON.stringify(order))
                }
            } catch(err) {
                this.logger.error('OrderAdjust: adjusted failed: ' + JSON.stringify([order, err]))
            }

            delete this.runningOrders[order.id]
        }

        return Promise.all(orders.map(order => {
            return visitExchangeOrder(order)
        }))
    }

    executeOrder(exchangeName, order) {
        return new Promise(async resolve => {
            await this.triggerOrder(resolve, exchangeName, order)
        })
    }

    cancelOrder(exchangeName, orderId) {
        return new Promise(async resolve => {
            let exchange = this.exchangeManager.get(exchangeName)
            if (!exchange) {
                console.error('Invalid exchange: ' + exchangeName)

                resolve()
                return;
            }

            try {
                resolve(await exchange.cancelOrder(orderId))
            } catch(err) {
                this.logger.error('Order cancel error: ' + orderId + err)
                console.log('Order error: ' + orderId + err)

                resolve()
            }
        })
    }

    cancelAll(exchangeName, symbol) {
        return new Promise(async resolve => {
            let exchange = this.exchangeManager.get(exchangeName)
            if (!exchange) {
                console.error('Invalid exchange: ' + exchangeName)

                resolve()
                return;
            }

            try {
                resolve(await exchange.cancelAll(symbol))
            } catch(err) {
                this.logger.error('Order cancel all error: ' + symbol)
                console.log('Order all error: ' + symbol)

                resolve()
            }
        })
    }

    async triggerOrder(resolve, exchangeName, order, retry = 0) {
        if(retry > this.systemUtil.getConfig('order.retry', 3)) {
            console.log('Retry limit stop creating order: ' + JSON.stringify(order))
            resolve()
            return
        }

        if (retry > 0) {
            this.logger.info('Retry (' + retry + ') creating order: ' + JSON.stringify(order))
            console.log('Retry (' + retry + ') creating order: ' + JSON.stringify(order))
        }

        let exchange = this.exchangeManager.get(exchangeName)
        if (!exchange) {
            console.error('Invalid exchange')

            resolve()
            return;
        }

        if (order.hasAdjustedPrice() === true) {
            order = await this.createAdjustmentOrder(exchangeName, order)
        }

        let exchangeOrder = undefined
        try {
            exchangeOrder = await exchange.order(order)
        } catch(err) {
            this.logger.error('Order canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(err))
            console.log('Order canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(err))

            resolve()
            return
        }

        if (exchangeOrder.retry === true) {
            setTimeout(async () => {
                console.log('Order rejected: ' + JSON.stringify(exchangeOrder))

                let retryOrder = await this.createRetryOrder(exchangeName, order)

                await this.triggerOrder(resolve, exchangeName, retryOrder, ++retry)
            }, this.systemUtil.getConfig('order.retry_ms', 1500));

            return
        }

        this.logger.info('Order created: ' + JSON.stringify(exchangeOrder))
        console.log('Order created: ' + JSON.stringify([exchangeOrder.id, exchangeName, exchangeOrder.symbol, exchangeOrder.symbol]))

        this.orders.push({
            'id': exchangeOrder.id,
            'exchange': exchangeName,
            'exchangeOrder': exchangeOrder,
            'order': order,
        })

        resolve(exchangeOrder)
    }

    /**
     * Follow orderbook aks / bid to be the first on the list
     *
     * @param exchangeName
     * @param order
     * @returns {Promise<*>}
     */
    createAdjustmentOrder(exchangeName, order)
    {
        return new Promise(async resolve => {
            let price = await this.getCurrentPrice(exchangeName, order.symbol, order.side)
            resolve(Order.createRetryOrderWithPriceAdjustment(order, price))
        })
    }

    getCurrentPrice(exchangeName, symbol, side)
    {
        return new Promise(resolve => {
            let ticker = this.tickers.get(exchangeName, symbol)

            if(!ticker) {
                console.log('Unknown ticker: ' + JSON.stringify([exchangeName, symbol, side]))
                resolve()
                return
            }

            let price = ticker.bid
            if(side === 'short') {
                price = ticker.ask * -1
            }

            resolve(price)
        })
    }

    createRetryOrder(exchangeName, order)
    {
        return new Promise(resolve => {
            resolve(Order.createRetryOrder(order))
        })
    }
}
