'use strict';

let Order = require('../../dict/order')
let ExchangeOrder = require('../../dict/exchange_order')

module.exports = class RiskRewardRatioCalculator {
    constructor(logger) {
        this.logger = logger
    }

    async calculateForOpenPosition(position, options = {'stop_percent': 3, 'target_percent': 6}) {
        return new Promise(resolve => {
            let entryPrice = position.entry;
            if (!entryPrice) {
                this.logger.info('Invalid position entryPrice for stop loss:' + JSON.stringify(position))
                resolve()

                return
            }

            let result = {
                'stop': undefined,
                'target': undefined,
            }

            entryPrice = Math.abs(entryPrice)

            if (position.side === 'long') {
                result['target'] = entryPrice * (1 + options.target_percent / 100)
                result['stop'] = entryPrice * (1 - options.stop_percent / 100)
            } else {
                result['target'] = entryPrice * (1 - options.target_percent / 100)
                result['stop'] = entryPrice * (1 + options.stop_percent / 100)
            }

            resolve(result)
        })
    }

    async syncRatioRewardOrders(position, orders, options) {
        let newOrders = {}

        let riskRewardRatio = await this.calculateForOpenPosition(position, options)

        if (orders.filter(order => order.type === ExchangeOrder.TYPE_STOP).length === 0) {
            newOrders['stop'] = {
                'amount': Math.abs(position.amount),
                'price': riskRewardRatio.stop
            }

            // inverse price for lose long position via sell
            if (position.side === 'long') {
                newOrders['stop']['price']  = newOrders['stop']['price']  * -1
            }
        }

        if (orders.filter(order => order.type === ExchangeOrder.TYPE_LIMIT).length === 0) {
            newOrders['target'] = {
                'amount': Math.abs(position.amount),
                'price': riskRewardRatio.target
            }

            // inverse price for lose long position via sell
            if (position.side === 'long') {
                newOrders['target']['price']  = newOrders['target']['price'] * -1
            }
        }

        return newOrders
    }

    async createRiskRewardOrdersOrders(position, orders, options) {
        let ratioOrders = await this.syncRatioRewardOrders(position, orders, options)

        let newOrders = []
        if (ratioOrders.target) {
            newOrders.push(Order.createCloseLimitPostOnlyReduceOrder(position.symbol, ratioOrders.target.price, ratioOrders.target.amount))
        }

        if (ratioOrders.stop) {
            newOrders.push(Order.createStopLossOrder(position.symbol, ratioOrders.stop.price, ratioOrders.stop.amount))
        }

        return newOrders
    }
}
