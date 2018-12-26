'use strict';

var _ = require('lodash')

module.exports = class ExchangeManager {
    constructor(exchangesIterator, logger, instances, config) {
        this.logger = logger
        this.instances = instances
        this.config = config
        this.exchangesIterator = exchangesIterator

        this.exchanges = []
    }

    init() {
        let exchanges = this.exchangesIterator

        let symbols = {}

        exchanges.map(exchange => exchange.getName()).forEach(exchangeName => {
            let pairs = this.instances.symbols.filter((symbol) => {
                return symbol['exchange'] === exchangeName && symbol['state'] === 'watch';
            })

            if (pairs.length === 0) {
                return
            }

            symbols[exchangeName] = pairs
        })

        let activeExchanges = exchanges.filter(exchange => exchange.getName() in symbols)

        activeExchanges.forEach(activeExchange => activeExchange.start(
            _.get(this.config, 'exchanges.' + activeExchange.getName(), {}),
            symbols[activeExchange.getName()])
        )

        this.exchanges = activeExchanges
    }

    all() {
        return this.exchanges
    }

    get(name) {
        return this.exchanges.find(exchange => exchange.getName() === name)
    }

    async getPosition(exchangeName, symbol) {
        return new Promise(async (resolve) => {
            let exchange = this.get(exchangeName);
            if (!exchange) {
                resolve()
                return;
            }

            resolve(await exchange.getPositionForSymbol(symbol))
        })
    }

    async getOrders(exchangeName, symbol) {
        return new Promise(async (resolve) => {
            let exchange = this.get(exchangeName);
            if (!exchange) {
                resolve([])
                return
            }

            resolve(await exchange.getOrdersForSymbol(symbol))
        })
    }
}
