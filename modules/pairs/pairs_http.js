'use strict';

let Order = require('./../../dict/order')

module.exports = class PairsHttp {
    constructor(instances, exchangeManager, orderExecutor, orderCalculator) {
        this.instances = instances
        this.exchangeManager = exchangeManager
        this.orderExecutor = orderExecutor
        this.orderCalculator = orderCalculator
    }

    async getTradePairs() {
        return new Promise(async (resolve) => {
            let pairs = []

            for (const symbol of this.instances.symbols) {
                let position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol)

                pairs.push({
                    'exchange': symbol.exchange,
                    'symbol': symbol.symbol,
                    'watchdogs': symbol.watchdogs,
                    'state': symbol.state,
                    'has_position': position !== undefined,
                    'in_order_process': false,
                })
            }

            resolve(pairs)
        })
    }

    async executeOrder(exchangeName, symbol, side) {
        return new Promise(async resolve => {
            let orderSize = this.orderCalculator.calculateOrderSize(exchangeName, symbol)
            if (!orderSize) {
                console.error('Invalid order size: ' + JSON.stringify([exchangeName, symbol, side]))
                resolve()
                return
            }

            let order = await this.orderExecutor.executeOrder(
                exchangeName,
                Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder(symbol, side, orderSize)
            )

            resolve(order)
        })
    }
}
