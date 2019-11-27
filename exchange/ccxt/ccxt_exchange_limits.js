'use strict';

let OrderUtil = require('../../utils/order_util')

module.exports = class CcxtExchangeLimits {
    updateMarkets(markets) {
        this.markets = markets
    }

    /**
     * LTC: 0.008195 => 0.00820
     *
     * @param price
     * @param symbol
     * @returns {*}
     */
    calculatePrice(price, symbol) {
        let market = this.markets.find(market => market.id === symbol || market.symbol === symbol)
        if (!market || !market.limits || !market.limits.price || !market.limits.price.min) {
            return undefined
        }

        return OrderUtil.calculateNearestSize(price, market.limits.price.min)
    }

    /**
     * LTC: 0.65 => 1
     *
     * @param amount
     * @param symbol
     * @returns {*}
     */
    calculateAmount(amount, symbol) {
        let market = this.markets.find(market => market.id === symbol || market.symbol === symbol)
        if (!market || !market.limits || !market.limits.amount || !market.limits.amount.min) {
            return undefined
        }

        return OrderUtil.calculateNearestSize(amount, market.limits.amount.min)
    }
}