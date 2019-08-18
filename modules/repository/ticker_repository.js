'use strict';

module.exports = class TickerRepository {
    constructor(db, logger) {
        this.db = db
        this.logger = logger
    }

    insertTickers(tickers) {
        let logger = this.logger;

        return new Promise(resolve => {
            this.db.beginTransaction((err, transaction) => {
                tickers.forEach(ticker => {
                    let update = '' +
                        'UPDATE ticker SET ask=$ask, bid=$bid, updated_at=$updated_at WHERE exchange=$exchange AND symbol=$symbol;';

                    let insert = 'INSERT OR IGNORE INTO ticker(exchange, symbol, ask, bid, updated_at) VALUES ($exchange, $symbol, $ask, $bid, $updated_at);';

                    let parameters = {
                        '$exchange': ticker.exchange,
                        '$symbol': ticker.symbol,
                        '$ask': ticker.ask,
                        '$bid': ticker.bid,
                        '$updated_at': new Date().getTime()
                    };

                    transaction.run(update, parameters);
                    transaction.run(insert, parameters);
                });

                transaction.commit((err) => {
                    if (err) {
                        logger.error('Ticker log error: ' + JSON.stringify(err))
                    }

                    resolve()
                });
            });
        })
    }
};
