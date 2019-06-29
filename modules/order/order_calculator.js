'use strict';

let _ = require('lodash');

module.exports = class OrderCalculator {
    constructor(instances, tickers, logger, exchangeManager) {
        this.instances = instances;
        this.tickers = tickers;
        this.logger = logger;
        this.exchangeManager = exchangeManager
    }

    async calculateOrderSize(exchangeName, symbol) {
        let orderSizeCalculated = await this.getSymbolCapital(exchangeName, symbol);
        if (!orderSizeCalculated) {
            return
        }

        // normalize the size to allowed size
        let orderSize = this.exchangeManager.get(exchangeName).calculateAmount(orderSizeCalculated, symbol);
        if (!orderSize) {
            this.logger.error('Can no normalize buy price: ' + JSON.stringify([exchangeName, symbol, orderSize]));

            return
        }

        return orderSize
    }

    async getSymbolCapital(exchange, symbol) {
        let capital = this.instances.symbols.find(instance =>
            instance.exchange === exchange && instance.symbol === symbol &&
            (_.get(instance, 'trade.capital', 0) > 0)
        );

        if (capital) {
            return capital.trade.capital
        }

        let capitalCurrency = this.instances.symbols.find(instance =>
            instance.exchange === exchange && instance.symbol === symbol &&
            (_.get(instance, 'trade.currency_capital', 0) > 0)
        );

        if (capitalCurrency) {
            return await this.convertCurrencyToAsset(exchange, symbol, capitalCurrency.trade.currency_capital)
        }


    }

    /**
     * If you want to trade with 0.25 BTC this calculated the asset amount which are available to buy
     *
     * @param exchangeName
     * @param symbol
     * @param currencyAmount
     * @returns {Promise<number>}
     */
    async convertCurrencyToAsset(exchangeName, symbol, currencyAmount) {
        let ticker = this.tickers.get(exchangeName, symbol);
        if (!ticker || !ticker.bid) {
            this.logger.error('Invalid ticker for calculate currency capital:' + JSON.stringify([exchangeName, symbol, currencyAmount]));
            return
        }

        return currencyAmount / ticker.bid
    }
};
