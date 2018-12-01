'use strict';

module.exports = class PairsHttp {
    constructor(instances, exchangeManager) {
        this.instances = instances
        this.exchangeManager = exchangeManager
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
                    'has_order': true,
                })
            }

            resolve(pairs)
        })
    }
}
