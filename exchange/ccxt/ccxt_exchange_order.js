'use strict';

let OrderBag = require('../utils/order_bag')
let Order = require('../../dict/order')
let ExchangeOrder = require('../../dict/exchange_order')
let CcxtUtil = require('../utils/ccxt_util')

module.exports = class CcxtExchangeOrder {
    constructor(ccxtClient, symbols, logger) {
        this.orderbag = new OrderBag()
        this.symbols = symbols
        this.logger = logger
        this.ccxtClient = ccxtClient
    }

    async createOrder(order) {
        let payload = CcxtUtil.createExchangeOrder(order)
        let result = undefined

        try {
            result = await this.client.order(payload)
        } catch (e) {
            this.logger.error(this.ccxtClient.name + ': order create error: ' + JSON.stringify(e.message, order, payload))

            if(e.message && e.message.toLowerCase().includes('insufficient balance')) {
                return ExchangeOrder.createRejectedFromOrder(order);
            }

            return
        }

        let exchangeOrder = Binance.createOrders(result)[0]
        this.triggerOrder(exchangeOrder)
        return exchangeOrder
    }

    async syncOrders() {
        let result = await CcxtUtil.createExchangeOrder(await this.ccxtClient.fetchOpenOrders());
        result.forEach(order => this.triggerOrder(order))
        return result
    }

    /**
     * Force an order update only if order is "not closed" for any reason already by exchange
     *
     * @param order
     */
    triggerOrder(order) {
        return this.orderbag.triggerOrder(order);
    }

    getOrders() {
        return this.orderbag.getOrders();
    }

    findOrderById(id) {
        return this.orderbag.findOrderById(id);
    }

    getOrdersForSymbol(symbol) {
        return this.orderbag.getOrdersForSymbol(symbol);
    }

    async updateOrder(id, order) {
        if (!order.amount && !order.price) {
            throw 'Invalid amount / price for update'
        }

        let currentOrder = await this.findOrderById(id);
        if (!currentOrder) {
            return
        }

        // cancel order; mostly it can already be canceled
        await this.cancelOrder(id)

        return await this.createOrder(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount))
    }

    async cancelOrder(id) {
        let order = await this.findOrderById(id)
        if (!order) {
            return
        }

        try {
            await this.ccxtClient.cancelOrder(id)
        } catch (e) {
            this.logger.error(this.ccxtClient.name + ': cancel order error: ' + e)
            return
        }

        this.orderbag.delete(id)

        return ExchangeOrder.createCanceled(order)
    }

    async cancelAll(symbol) {
        let orders = []

        for (let order of (await this.getOrdersForSymbol(symbol))) {
            orders.push(await this.cancelOrder(order.id))
        }

        return orders
    }
}
