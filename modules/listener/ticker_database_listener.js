'use strict';

module.exports = class TickerDatabaseListener {
    constructor(db, logger) {
        this.db = db
        this.logger = logger
    }

    onTicker(tickerEvent) {
        let logger = this.logger
        let ticker = tickerEvent.ticker

        this.db.beginTransaction(async (err, transaction) => {
            let update = '' +
                'UPDATE ticker SET ask=$ask, bid=$bid, updated_at=$updated_at\n' +
                'WHERE exchange=$exchange AND symbol=$symbol;'

            let insert = '' +
                'INSERT OR IGNORE INTO ticker(exchange, symbol, ask, bid, updated_at) VALUES ($exchange, $symbol, $ask, $bid, $updated_at);'

            let parameters = {
                '$exchange': ticker.exchange,
                '$symbol': ticker.symbol,
                '$ask': ticker.ask,
                '$bid': ticker.bid,
                '$updated_at': new Date().getTime()
            };

            transaction.run(update, parameters);
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