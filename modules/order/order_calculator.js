'use strict';

var _ = require('lodash')

module.exports = class OrderExecutor {
    constructor(instances) {
        this.instances = instances
    }

    calculateOrderSize(exchange, symbol) {
        let capital = this.getSymbolCapital(exchange, symbol)
        if (!capital) {
            return
        }

        return capital
    }

    getSymbolCapital(exchange, symbol) {
        let instance = this.instances.symbols.filter(instance =>
            _.get(instance, 'trade.capital', 0) > 0
        ).find(instance => {
            return instance.exchange === exchange && instance.symbol === symbol
        })

        if (!instance) {
            return
        }

        return instance.trade.capital
    }
}
