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
}
