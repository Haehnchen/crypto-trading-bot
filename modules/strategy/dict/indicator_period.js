'use strict';

module.exports = class IndicatorPeriod {
    constructor(strategyContext, indicators) {
        this.strategyContext = strategyContext
        this.indicators = indicators
    }

    getPrice() {
        return this.strategyContext.bid
    }

    getLastSignal() {
        if (!this.strategyContext || !this.strategyContext.lastSignal) {
            return undefined
        }

        return this.strategyContext.lastSignal
    }

    getIndicator(key) {
        for (let k in this.indicators) {
            if (k === key) {
                return this.indicators[k]
            }
        }

        return undefined
    }
}
