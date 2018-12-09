'use strict';

let fs = require('fs')
var _ = require('lodash')

module.exports = class ExchangeManager {
    constructor(eventEmitter, logger, instances, config) {
        this.eventEmitter = eventEmitter
        this.logger = logger
        this.instances = instances
        this.config = config

        this.exchanges = []
    }

    init() {
        let exchanges = this.createExchanges()

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
                return;
            }

            return await exchange.getOrdersForSymbol(symbol)
        })
    }

    async createOrder(exchangeName, order) {
        return new Promise(async (resolve) => {
            let exchange = this.get(exchangeName)
            if (!exchange) {
                resolve()
                return;
            }

            let orderResult = undefined
            try {
                orderResult = await exchange.order(order)
            } catch(err) {
                this.logger.error('Order canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(err))
            }

            return resolve(orderResult)
        })
    }

    createExchanges() {
        let exchanges = []

        let dir = __dirname + '/../../exchange'

        if (!fs.existsSync(dir)) {
            return
        }

        let eventEmitter = this.eventEmitter
        let logger = this.logger

        fs.readdirSync(dir).forEach(file => {
            if (file.endsWith('.js')) {
                exchanges.push(new (require(dir + '/' + file.substr(0, file.length - 3)))(
                    eventEmitter,
                    logger
                ))
            }
        })

        return exchanges
    }
}
