'use strict';

module.exports = class PairStateManager {
    constructor(logger) {
        this.logger = logger;
        this.stats = {}
    }

    update(exchange, symbol, state, options = {}) {
        if (!['long', 'close', 'short', 'cancel'].includes(state)) {
            this.logger.error('Invalidate state: ' + state);
            throw 'Invalidate state: ' + state
        }

        let vars = {
            'state': state,
            'options': options || {},
            'time': new Date(),
            'symbol': symbol,
            'exchange': exchange,
        };

        this.logger.info('Pair state changed: ' + JSON.stringify({
            'new': vars,
            'old': this.stats[exchange + symbol] || {},
        }));

        this.stats[exchange + symbol] = vars
    }

    get(exchange, symbol) {
        if ((exchange + symbol) in this.stats) {
            return this.stats[exchange + symbol]
        }

        return undefined
    }

    all() {
        let stats = [];

        for (let key in this.stats) {
            stats.push(this.stats[key])
        }

        return stats
    }

    clear(exchange, symbol) {
        if ((exchange + symbol) in this.stats) {
            this.logger.debug('Pair state cleared: ' + JSON.stringify(this.stats[exchange + symbol]))
        }

        delete this.stats[exchange + symbol]
    }

    getSellingPairs() {
        let pairs = [];

        for (let key in this.stats) {
            if (this.stats[key].state === 'short') {
                pairs.push(this.stats[key])
            }
        }

        return pairs
    }

    getBuyingPairs() {
        let pairs = [];

        for (let key in this.stats) {
            if (this.stats[key].state === 'long') {
                pairs.push(this.stats[key])
            }
        }

        return pairs
    }

    getClosingPairs() {
        let pairs = [];

        for (let key in this.stats) {
            if (this.stats[key].state === 'close') {
                pairs.push(this.stats[key])
            }
        }

        return pairs
    }

    getCancelPairs() {
        let pairs = [];

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
};
