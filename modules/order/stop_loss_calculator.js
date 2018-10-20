'use strict';

module.exports = class StopLossCalculator {
    constructor(tickers, logger) {
        this.tickers = tickers
        this.logger = logger
    }

    async calculateForOpenPosition(exchange, position, options = {'percent_lost': 3}) {
        let tickers = this.tickers

        return new Promise(resolve => {
            if (!position.entry) {
                this.logger.info('Invalid position entry for stop loss:' + JSON.stringify(position))
                resolve()

                return
            }

            let price = undefined
            if (position.side === 'long') {
                if (options.percent_lost) {
                    price = position.entry * (1 - options.percent_lost / 100)
                }
            } else {
                if (options.percent_lost) {
                    price = position.entry * (1 + options.percent_lost / 100)
                }
            }

            // invalid price no value
            if (!price) {
                this.logger.info('Empty price for stop loss:' + JSON.stringify(position))

                return resolve()
            }


            let ticker = tickers.get(exchange, position.symbol)

            if (!ticker) {
                this.logger.info('Ticker not found for stop loss:' + JSON.stringify(position))

                resolve()
                return
            }

            if (position.side === 'long') {
                if (price > ticker.ask) {
                    this.logger.info('Ticker out of range stop loss:' + JSON.stringify(position) + JSON.stringify(ticker))

                    resolve()
                    return
                }
            } else if (position.side === 'short') {
                if (price < ticker.bid) {
                    this.logger.info('Ticker out of range stop loss:' + JSON.stringify(position) + JSON.stringify(ticker))

                    resolve()
                    return
                }
            }

            resolve(price)
        })
    }
}
