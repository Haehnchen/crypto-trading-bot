'use strict';

let Candlestick = require('../../dict/candlestick')

module.exports = class CandlestickRepository {
    constructor(db) {
        this.db = db
    }

    getLookbacksForPair(exchange, symbol, period, limit = 750) {
        return new Promise((resolve) => {
            let sql = 'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? order by time DESC LIMIT ' + limit

            this.db.all(sql, [exchange, symbol, period], (err, rows) => {
                if (err) {
                    console.log(err);
                    return resolve();
                }

                resolve(rows.map((row) => {
                    return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
                }))
            })
        })
    }

    getLookbacksSince(exchange, symbol, period, start) {
        return new Promise((resolve) => {
            let sql = 'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? and time > ? order by time DESC'

            this.db.all(sql, [exchange, symbol, period, start], (err, rows) => {
                if (err) {
                    console.log(err);
                    return resolve();
                }

                resolve(rows.map((row) => {
                    return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
                }))
            })
        })
    }

    getCandlesInWindow(exchange, symbol, period, start, end) {
        return new Promise((resolve) => {
            let sql = 'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? and time > ?  and time < ? order by time DESC LIMIT 1000'

            this.db.all(sql, [exchange, symbol, period, Math.round(start.getTime() / 1000), Math.round(end.getTime() / 1000)], (err, rows) => {
                if (err) {
                    console.log(err);
                    return resolve();
                }

                resolve(rows.map((row) => {
                    return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
                }))
            })
        })
    }

    getExchangePairs() {
        return new Promise((resolve) => {
            let sql = 'select exchange, symbol from candlesticks group by exchange, symbol order by exchange, symbol'

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.log(err);
                    return resolve();
                }

                resolve(rows)
            })
        })
    }

    insertCandles(exchangeCandlesticks) {
        return new Promise(resolve => {
            this.db.beginTransaction((err, transaction) => {
                exchangeCandlesticks.forEach(exchangeCandlestick => {
                    // Try to update any existing row
                    let update = '' +
                        'UPDATE candlesticks SET exchange=$exchange, symbol=$symbol, period=$period, time=$time, open=$open, high=$high, low=$low, close=$close, volume=$volume\n' +
                        'WHERE exchange=$exchange AND symbol=$symbol AND period=$period AND time=$time'

                    let insert = '' +
                        'INSERT OR IGNORE INTO candlesticks(exchange, symbol, period, time, open, high, low, close, volume) VALUES ($exchange, $symbol, $period, $time, $open, $high, $low, $close, $volume)'

                    let parameters = {
                        '$exchange': exchangeCandlestick.exchange,
                        '$symbol': exchangeCandlestick.symbol,
                        '$period': exchangeCandlestick.period,
                        '$time': exchangeCandlestick.time,
                        '$open': exchangeCandlestick.open,
                        '$high': exchangeCandlestick.high,
                        '$low': exchangeCandlestick.low,
                        '$close': exchangeCandlestick.close,
                        '$volume': exchangeCandlestick.volume
                    };

                    transaction.run(update, parameters);
                    transaction.run(insert, parameters);
                })

                transaction.commit((err) => {
                    if (err) {
                        return console.log("Sad panda :-( commit() failed.", err);
                    }

                    resolve()
                });
            });
        })
    }
}
