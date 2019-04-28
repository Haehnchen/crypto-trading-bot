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

        this.tickerPriceInterval = 200
        this.tickerPriceRetries = 40

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
            if (this.runningOrders[orderId] < moment().subtract(2, 'minutes')) {
                delete this.runningOrders[orderId]
            }
        }

        let visitExchangeOrder = async orderContainer => {
            let exchange = this.exchangeManager.get(orderContainer.exchange)
            if (!exchange) {
                console.error('OrderAdjust: Invalid exchange:' + orderContainer.exchange)
                delete this.runningOrders[orderContainer.id]

                return
            }

            // order not known by exchange cleanup
            let lastExchangeOrder = await exchange.findOrderById(orderContainer.id);
            if (!lastExchangeOrder || lastExchangeOrder.status !== 'open') {
                this.logger.info('OrderAdjust: Unknown order cleanup: ' + JSON.stringify([orderContainer.exchangeOrder.id, orderContainer.exchange, orderContainer.symbol]))

                // async issues? we are faster then exchange; even in high load: implement a global order management
                // and filter out executed order (eg LIMIT order process)
                this.orders = this.orders.filter(myOrder =>
                    myOrder.id !== orderContainer.id
                )

                delete this.runningOrders[orderContainer.id]

                return
            }

            if (orderContainer.id in this.runningOrders) {
                this.logger.info('OrderAdjust: already running: ' + JSON.stringify([orderContainer.id, orderContainer.exchange, orderContainer.symbol]))
                return
            }

            this.runningOrders[orderContainer.id] = new Date()

            let price = await this.getCurrentPrice(orderContainer.exchange, orderContainer.order.symbol, orderContainer.order.side)
            if (!price) {
                this.logger.info('OrderAdjust: No up to date ticker price found: ' + JSON.stringify([orderContainer.exchange, orderContainer.order.symbol, orderContainer.order.side]))

                delete this.runningOrders[orderContainer.id]

                return
            }

            let orderUpdate = Order.createPriceUpdateOrder(orderContainer.exchangeOrder.id, price)

            // normalize prices for positions compare; we can have negative prices depending on "side"
            if (Math.abs(lastExchangeOrder.price) === Math.abs(price)) {
                this.logger.info('OrderAdjust: No price update needed:' + JSON.stringify([lastExchangeOrder.id, Math.abs(lastExchangeOrder.price), Math.abs(price), orderContainer.exchange, orderContainer.order.symbol]))
                delete this.runningOrders[orderContainer.id]

                return
            }

            try {
                let updatedOrder = await exchange.updateOrder(orderUpdate.id, orderUpdate)

                if (updatedOrder.status === 'open') {
                    this.logger.info('OrderAdjust: Order adjusted with orderbook price: ' + JSON.stringify([updatedOrder.id, Math.abs(lastExchangeOrder.price), Math.abs(price), orderContainer.exchange, orderContainer.order.symbol]))
                } else if(updatedOrder.status === 'canceled' && updatedOrder.retry === true) {
                    // we update the price outside the orderbook price range on PostOnly we will cancel the order directly
                    this.logger.error('OrderAdjust: Updated order canceled recreate: ' + JSON.stringify(orderContainer))

                    // recreate order
                    // @TODO: resync used balance in case on order is partially filled
                    await this.executeOrder(orderContainer.exchange, Order.createRetryOrder(orderContainer.order))
                } else {
                    this.logger.error('OrderAdjust: Unknown order state: ' + JSON.stringify(orderContainer))
                }
            } catch(err) {
                this.logger.error('OrderAdjust: adjusted failed: ' + JSON.stringify([String(err), orderContainer, orderUpdate]))
            }

            delete this.runningOrders[orderContainer.id]
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
                this.logger.error('Order cancel error: ' + orderId + ' ' + err)
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
        if(retry > this.systemUtil.getConfig('order.retry', 4)) {
            this.logger.error(`Retry (${retry}) creating order reached: ` + JSON.stringify(order))
            resolve()
            return
        }

        if (retry > 0) {
            this.logger.info(`Retry (${retry}) creating order: ` + JSON.stringify(order))
        }

        let exchange = this.exchangeManager.get(exchangeName)
        if (!exchange) {
            console.error('Invalid exchange: ' + exchangeName)

            resolve()
            return
        }

        if (order.hasAdjustedPrice() === true) {
            order = await this.createAdjustmentOrder(exchangeName, order)

            if (!order) {
                this.logger.error('Order price adjust failed:' + JSON.stringify([exchangeName, order]))
                resolve()
                return
            }
        }

        let exchangeOrder = undefined
        try {
            exchangeOrder = await exchange.order(order)
        } catch(err) {
            this.logger.error('Order create canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(String(err)))

            resolve()
            return
        }

        if (exchangeOrder.status === 'canceled' && exchangeOrder.retry === false) {
            this.logger.error('Order create canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(exchangeOrder))

            resolve(exchangeOrder)
            return
        }

        if (exchangeOrder.retry === true) {
            this.logger.info('Order not placed force retry: ' + JSON.stringify(exchangeOrder))

            setTimeout(async () => {
                let retryOrder = Order.createRetryOrder(order)

                await this.triggerOrder(resolve, exchangeName, retryOrder, ++retry)
            }, this.systemUtil.getConfig('order.retry_ms', 1500));

            return
        }

        this.logger.info('Order created: ' + JSON.stringify([exchangeOrder.id, exchangeName, exchangeOrder.symbol, order, exchangeOrder]))
        console.log('Order created: ' + JSON.stringify([exchangeOrder.id, exchangeName, exchangeOrder.symbol]))

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
            if(!price) {
                this.logger.error('Stop creating order; can not find up to date ticker price: ' + JSON.stringify([exchangeName, order.symbol, order.side]))
                resolve()
                return
            }

            resolve(Order.createRetryOrderWithPriceAdjustment(order, price))
        })
    }

    /**
     * Get current price based on the ticker. This function is block and waiting until getting an up to date ticker price
     *
     * @param exchangeName
     * @param symbol
     * @param side
     * @returns {Promise<any>}
     */
    getCurrentPrice(exchangeName, symbol, side)
    {
        return new Promise(async resolve => {
            let wait = (time) => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, time);
                });
            }

            let ticker = undefined

            for (let retry = 0; retry < this.tickerPriceRetries; retry++) {
                ticker = this.tickers.getIfUpToDate(exchangeName, symbol, 10000)
                if (ticker) {
                    break
                }

                await wait(this.tickerPriceInterval)
            }

            // fallback
            if (!ticker) {
                ticker = this.tickers.get(exchangeName, symbol)
            }

            if (!ticker) {
                this.logger.error('OrderExecutor: ticker price not found: ' + JSON.stringify([exchangeName, symbol, side]))
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
}
