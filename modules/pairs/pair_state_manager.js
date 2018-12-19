'use strict';

module.exports = class PairStateManager {
    constructor() {
        this.stats = {}
    }

    update(exchange, symbol, state, options = {}) {
        if (!['long', 'close', 'short', 'cancel'].includes(state)) {
            throw 'Invalidate state: ' + state
        }

        this.stats[exchange + symbol] = {
            'state': state,
            'options': options || {},
            'time': new Date(),
            'symbol': symbol,
            'exchange': exchange,
        }
    }

    get(exchange, symbol) {
        if ((exchange + symbol) in this.stats) {
            return this.stats[exchange + symbol]
        }

        return undefined
    }

    all() {
        let stats = []

        for (let key in this.stats) {
            stats.push(this.stats[key])
        }

        return stats
    }

    clear(exchange, symbol) {
        delete this.stats[exchange + symbol]
    }

    getSellingPairs() {
        let pairs = []

        for (let key in this.stats) {
            if (this.stats[key].state === 'short') {
                pairs.push(this.stats[key])
            }
        }

        return pairs
    }

    getBuyingPairs() {
        let pairs = []

        for (let key in this.stats) {
            if (this.stats[key].state === 'long') {
                pairs.push(this.stats[key])
            }
        }

        return pairs
    }

    getClosingPairs() {
        let pairs = []

        for (let key in this.stats) {
            if (this.stats[key].state === 'close') {
                pairs.push(this.stats[key])
            }
        }

        return pairs
    }

    getCancelPairs() {
        let pairs = []

        for (let key in this.stats) {
            if (this.stats[key].state === 'cancel') {
                pairs.push(this.stats[key])
            }
        }

        return pairs
    }

    isNeutral(exchange, symbol) {
        return !((exchange + symbol) in this.stats)
    }
}
