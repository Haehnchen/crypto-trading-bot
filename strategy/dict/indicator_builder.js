'use strict';

module.exports = class IndicatorBuilder {
    constructor() {
        this.indicators = {};
    }

    add(key, indicator, options) {
        this.indicators[key] = {
            'indicator': indicator,
            'key': key,
            'options': options || {},
        }
    }

    all() {
        let indicators = []

        for (let key in this.indicators) {
            indicators.push(this.indicators[key])
        }

        return indicators
    }
}
