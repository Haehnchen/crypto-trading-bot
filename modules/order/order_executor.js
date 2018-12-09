'use strict';

let Order = require('../../dict/order')
var _ = require('lodash')

module.exports = class OrderExecutor {
    constructor(exchangeManager, tickers, logger) {
        this.exchangeManager = exchangeManager
        this.tickers = tickers
        this.logger = logger
        this.orderRetryMs = 1500

        this.orders = []
    }

    /**
     * Keep open orders in orderbook at first position
     */
    adjustOpenOrdersPrice() {
        let orders = this.orders.filter(order =>
            order.order.hasAdjustedPrice()
        )

        orders.forEach(async order => {
            let exchange = this.exchangeManager.get(order.exchange)
            if (!exchange) {
                console.error('Invalid exchange')
                return;
            }

            // order not known by exchange cleanup
            let lastExchangeOrder = await exchange.findOrderById(order.id);
            if (!lastExchangeOrder) {
                console.info('Unknown order cleanup: ' + order.exchangeOrder.id)
                this.logger.info('Unknown order cleanup: ' + order.exchangeOrder.id)

                this.orders = this.orders.filter(myOrder => {
                    return myOrder.id !== order.id
                })

                return
            }

            let price = await this.getCurrentPrice(order.exchange, order.order.symbol, order.order.side)
            let orderUpdate = Order.createPriceUpdateOrder(order.exchangeOrder.id, price)

            if(lastExchangeOrder.price === price) {
                this.logger.info('No price update needed:' + JSON.stringify(lastExchangeOrder.id))
                return
            }

            try {
                let updatedOrder = await exchange.updateOrder(orderUpdate.id, orderUpdate)
                this.logger.info('Order adjusted with orderbook price: ' + JSON.stringify(updatedOrder.id))
            } catch(err) {
                this.logger.error('Order adjusted failed:' + JSON.stringify(order) + ' - ' + JSON.stringify(err))
                console.error('Order adjusted failed:' + JSON.stringify(order) + ' - ' + JSON.stringify(err))
            }
        })
    }

    async executeOrder(exchangeName, order) {
        return new Promise(async resolve => {
            await this.triggerOrder(resolve, exchangeName, order)
        })
    }

    async triggerOrder(resolve, exchangeName, order, retry = 0) {
        if(retry > 3) {
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

        let orderResult = undefined
        try {
            orderResult = await exchange.order(order)
        } catch(err) {
            this.logger.error('Order canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(err))
            console.log('Order canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(err))

            resolve()
            return
        }

        if (orderResult.retry === true) {
            setTimeout(async () => {
                console.log('Order rejected: ' + JSON.stringify(orderResult))

                let retryOrder = await this.createRetryOrder(exchangeName, order)

                await this.triggerOrder(resolve, exchangeName, retryOrder, ++retry)
            }, this.orderRetryMs);

            return
        }

        this.logger.info('Order created: ' + JSON.stringify(orderResult))
        console.log('Order created: ' + JSON.stringify(orderResult))

        this.orders.push({
            'id': orderResult.id,
            'exchange': exchangeName,
            'exchangeOrder': orderResult,
            'order': order,
        })

        resolve(orderResult)
    }

    /**
     * Follow orderbook aks / bid to be the first on the list
     *
     * @param exchangeName
     * @param order
     * @returns {Promise<*>}
     */
    async createAdjustmentOrder(exchangeName, order)
    {
        return new Promise(async resolve => {
            let price = await this.getCurrentPrice(exchangeName, order.symbol, order.side)
            resolve(Order.createRetryOrderWithPriceAdjustment(order, price))
        })
    }


    async getCurrentPrice(exchangeName, symbol, side)
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

    async createRetryOrder(exchangeName, order)
    {
        return new Promise(resolve => {
            resolve(Order.createRetryOrder(order))
        })
    }
}
