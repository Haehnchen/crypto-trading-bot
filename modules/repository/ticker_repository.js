'use strict';

module.exports = class TickerRepository {
    constructor(db, logger) {
        this.db = db
        this.logger = logger
    }

    insertTickers(tickers) {
        return new Promise(resolve => {
            const insert = this.db.prepare('UPDATE ticker SET ask=$ask, bid=$bid, updated_at=$updated_at WHERE exchange=$exchange AND symbol=$symbol;');
            const update = this.db.prepare('INSERT OR IGNORE INTO ticker(exchange, symbol, ask, bid, updated_at) VALUES ($exchange, $symbol, $ask, $bid, $updated_at);');

            this.db.transaction(() => {
                tickers.forEach(ticker => {
                    let parameters = {
                        'exchange': ticker.exchange,
                        'symbol': ticker.symbol,
                        'ask': ticker.ask,
                        'bid': ticker.bid,
                        'updated_at': new Date().getTime()
                    };

                    insert.run(parameters);
                    update.run(parameters);
                })
            })();

            resolve()
        })
    }
};
