'use strict';

let moment = require('moment')
let Signal = require('../../dict/signal')

module.exports = class SignalRepository {
    constructor(db) {
        this.db = db
    }

    getValidSignals(exchange, symbol) {
        return new Promise((resolve) => {
            let sql = 'SELECT * from signals where state is NOT "executed" and income_at > ? and exchange = ?  and symbol = ?  order by income_at DESC LIMIT 1'

            this.db.all(sql, [Math.floor(moment().subtract(45, 'minutes').toDate() / 1000), exchange, symbol], (err, rows) => {
                if (err) {
                    console.log(err)
                    resolve()
                    return;
                }

                if(rows.length === 0) {
                    resolve()
                }

                resolve(rows.map((row) => {
                    return new Signal(row.id, row.exchange, row.symbol, row.side, row.income_at)
                })[0])
            });
        })
    }
}
