'use strict';

module.exports = class TickerLogListener {
    constructor(db, logger) {
        this.db = db
        this.logger = logger
    }

    onTicker(tickerEvent) {
        let logger = this.logger
        let ticker = tickerEvent.ticker

        this.db.beginTransaction(async (err, transaction) => {
            let insert = '' +
                'INSERT INTO ticker_log(exchange, symbol, ask, bid, income_at) VALUES ($exchange, $symbol, $ask, $bid, $income_at)'

            let parameters = {
                '$exchange': ticker.exchange,
                '$symbol': ticker.symbol,
                '$ask': ticker.ask,
                '$bid': ticker.bid,
                '$income_at': new Date().getTime()
            };

            transaction.run(insert, parameters);

            transaction.commit((err) => {
                if (err) {
                    logger.error('Ticker log error: ' + JSON.stringify(err))
                    return console.log("Sad panda :-( commit() failed.", err);
                }
            });
        });
    }
};