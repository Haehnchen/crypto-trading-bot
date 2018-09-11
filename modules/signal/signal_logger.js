'use strict';

module.exports = class SignalLogger {
    constructor(db, logger) {
        this.db = db
        this.logger = logger
    }

    signal(exchange, symbol, options, side, strategy) {
        let logger = this.logger

        this.db.beginTransaction((err, transaction) => {
            let insert = '' +
                'INSERT INTO signals(exchange, symbol, options, side, strategy, income_at) VALUES ($exchange, $symbol, $options, $side, $strategy, $income_at)'

            let parameters = {
                '$exchange': exchange,
                '$symbol': symbol,
                '$options': JSON.stringify(options || {}),
                '$side': side,
                '$strategy': strategy,
                '$income_at': Math.floor(Date.now() / 1000),
            };

            transaction.run(insert, parameters);

            transaction.commit((err) => {
                if (err) {
                    logger.error('Signal logger error:' + JSON.stringify(err))
                    console.log('Signal logger error:' + JSON.stringify(err))
                }
            });
        });
    }
};