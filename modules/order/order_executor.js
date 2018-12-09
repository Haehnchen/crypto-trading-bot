'use strict';

let Order = require('../../dict/order')

module.exports = class OrderExecutor {
    constructor(exchangeManager, tickers, logger) {
        this.exchangeManager = exchangeManager
        this.tickers = tickers
        this.logger = logger
        this.orderRetryMs = 1500
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
        return new Promise(resolve => {
            let ticker = this.tickers.get(exchangeName, order.symbol)

            let price = ticker.bid
            if(order.side === 'short') {
                price = ticker.ask
            }

            resolve(Order.createRetryOrderWithPriceAdjustment(order, price))
        })
    }

    async createRetryOrder(exchangeName, order)
    {
        return new Promise(resolve => {
            resolve(Order.createRetryOrder(order))
        })
    }
}
