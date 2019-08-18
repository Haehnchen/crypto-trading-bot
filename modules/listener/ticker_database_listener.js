'use strict';

let _ = require('lodash');

module.exports = class TickerDatabaseListener {
    constructor(tickerRepository) {
        this.trottle = {}

        setInterval(async () => {
            let tickers = Object.values(this.trottle)
            this.trottle = {}

            if (tickers.length > 0) {
                for (let chunk of _.chunk(tickers, 100)) {
                    await tickerRepository.insertTickers(chunk)
                }
            }
        }, 1000 * 15)
    }

    onTicker(tickerEvent) {
        let ticker = tickerEvent.ticker
        this.trottle[ticker.symbol + ticker.exchange] = ticker
    }
};