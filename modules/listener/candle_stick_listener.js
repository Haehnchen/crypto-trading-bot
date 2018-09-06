'use strict';

module.exports = class CandleStickListener {
    constructor(db) {
        this.db = db
    }

    onCandleStick(candleStickEvent) {
        this.db.beginTransaction(function(err, transaction) {
            candleStickEvent.candles.forEach(function (candle) {
                // Try to update any existing row
                let update = '' +
                    'UPDATE candlesticks SET exchange=$exchange, symbol=$symbol, period=$period, time=$time, open=$open, high=$high, low=$low, close=$close, volume=$volume\n' +
                    'WHERE exchange=$exchange AND symbol=$symbol AND period=$period AND time=$time'

                let insert = '' +
                    'INSERT OR IGNORE INTO candlesticks(exchange, symbol, period, time, open, high, low, close, volume) VALUES ($exchange, $symbol, $period, $time, $open, $high, $low, $close, $volume)'

                let parameters = {
                    '$exchange': candleStickEvent.exchange,
                    '$symbol': candleStickEvent.symbol,
                    '$period': candleStickEvent.period,
                    '$time': candle.time,
                    '$open': candle.open,
                    '$high': candle.high,
                    '$low': candle.low,
                    '$close': candle.close,
                    '$volume': candle.volume
                };

                transaction.run(update, parameters);
                transaction.run(insert, parameters);
            })

            transaction.commit((err) => {
                if (err) {
                    return console.log("Sad panda :-( commit() failed.", err);
                }
            });
        });
    }
};