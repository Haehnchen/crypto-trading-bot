'use strict';

module.exports = class CandleStickLogListener {
    constructor(db, logger) {
        this.db = db
        this.logger = logger
    }

    onCandleStick(candleStickEvent) {
        let logger = this.logger

        if(candleStickEvent.candles.length > 100) {
            return
        }

        this.db.beginTransaction(async function(err, transaction) {
            candleStickEvent.candles.forEach((candle) => {
                let insert = '' +
                    'INSERT INTO candlesticks_log(exchange, symbol, period, time, open, high, low, close, volume, income_at) VALUES ($exchange, $symbol, $period, $time, $open, $high, $low, $close, $volume, $income_at)'

                let parameters = {
                    '$exchange': candleStickEvent.exchange,
                    '$symbol': candleStickEvent.symbol,
                    '$period': candleStickEvent.period,
                    '$time': candle.time,
                    '$open': candle.open,
                    '$high': candle.high,
                    '$low': candle.low,
                    '$close': candle.close,
                    '$volume': candle.volume,
                    '$income_at': new Date().getTime()
                };

                transaction.run(insert, parameters);
            })

            transaction.commit((err) => {
                if (err) {
                    logger.error('Candlestick log error: ' + JSON.stringify(err))
                    return console.log("Sad panda :-( commit() failed.", err);
                }
            });
        });
    }
};