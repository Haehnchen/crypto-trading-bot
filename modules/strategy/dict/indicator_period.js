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

    /**
     * Generate to iterate over item, starting with latest one going to oldest.
     * You should "break" the iteration until you found what you needed
     *
     * @param limit
     * @returns {IterableIterator<object>}
     */
    *visitLatestIndicators(limit = 200) {
        for (let i = 1; i < limit; i++) {
            let result = {}

            for (let key in this.indicators) {
                if(!this.indicators[key][this.indicators[key].length - i]) {
                    continue
                }

                result[key] = this.indicators[key][this.indicators[key].length - i]
            }

            yield result
        }

        return undefined
    }

    /**
     * Get all indicator values from current candle
     */
    getLatestIndicators() {
        let result = {}

        for (let key in this.indicators) {
            result[key] = this.indicators[key][this.indicators[key].length - 1]
        }

        return result
    }

    /**
     * Get all indicator values from current candle
     */
    getLatestIndicator(key) {
        for (let k in this.indicators) {
            if (k === key) {
                return this.indicators[key][this.indicators[key].length - 1]
            }
        }

        return undefined
    }
}
