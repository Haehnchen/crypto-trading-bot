'use strict';

module.exports = class IndicatorPeriod {
    constructor(price, indicators) {
        this.price = price
        this.indicators = indicators
    }

    getPrice() {
        return this.price
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
