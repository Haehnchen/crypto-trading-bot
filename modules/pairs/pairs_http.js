'use strict';

module.exports = class PairsHttp {
    constructor(instances, exchangeManager, pairStateManager, eventEmitter) {
        this.instances = instances
        this.exchangeManager = exchangeManager
        this.pairStateManager = pairStateManager
        this.eventEmitter = eventEmitter
    }

    async getTradePairs() {
        return new Promise(async (resolve) => {
            let pairs = []

            for (const symbol of this.instances.symbols) {
                let position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol)
                let state = await this.pairStateManager.get(symbol.exchange, symbol.symbol)

                let item = {
                    'exchange': symbol.exchange,
                    'symbol': symbol.symbol,
                    'watchdogs': symbol.watchdogs,
                    'state': symbol.state,
                    'has_position': position !== undefined,
                }

                if (state && state.state) {
                    item['process'] = state.state
                }

                pairs.push(item)
            }

            resolve(pairs)
        })
    }

    async triggerOrder(exchangeName, symbol, side) {
        return new Promise(async resolve => {
            this.pairStateManager.update(exchangeName, symbol, side)
            this.eventEmitter.emit('order_pair_state')

            resolve()
        })
    }
}
