'use strict';

let Candlestick = require('../../dict/candlestick')

module.exports = class CandlestickRepository {
    constructor(db) {
        this.db = db
    }

    getLookbacksForPair(exchange, symbol, period, limit = 750) {
        return new Promise((resolve) => {
            const stmt = this.db.prepare('SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? order by time DESC LIMIT ' + limit);

            let result = stmt.all([exchange, symbol, period]).map((row) => {
                return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
            });

            resolve(result)
        })
    }

    getLookbacksSince(exchange, symbol, period, start) {
        return new Promise((resolve) => {
            const stmt = this.db.prepare('SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? and time > ? order by time DESC');

            let result = stmt.all([exchange, symbol, period, start]).map((row) => {
                return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
            });

            resolve(result)
        })
    }

    getCandlesInWindow(exchange, symbol, period, start, end) {
        return new Promise((resolve) => {
            const stmt = this.db.prepare('SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? and time > ?  and time < ? order by time DESC LIMIT 1000');

            let result = stmt.all([exchange, symbol, period, Math.round(start.getTime() / 1000), Math.round(end.getTime() / 1000)]).map((row) => {
                return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
            });

            resolve(result)
        })
    }

    getExchangePairs() {
        return new Promise((resolve) => {
            const stmt = this.db.prepare('select exchange, symbol from candlesticks group by exchange, symbol order by exchange, symbol');
            resolve(stmt.all())
        })
    }

    insertCandles(exchangeCandlesticks) {
        return new Promise(resolve => {
            const insert = this.db.prepare('UPDATE candlesticks SET exchange=$exchange, symbol=$symbol, period=$period, time=$time, open=$open, high=$high, low=$low, close=$close, volume=$volume WHERE exchange=$exchange AND symbol=$symbol AND period=$period AND time=$time');
            const update = this.db.prepare('INSERT OR IGNORE INTO candlesticks(exchange, symbol, period, time, open, high, low, close, volume) VALUES ($exchange, $symbol, $period, $time, $open, $high, $low, $close, $volume)');

            this.db.transaction(() => {
                exchangeCandlesticks.forEach(exchangeCandlestick => {
                    let parameters = {
                        'exchange': exchangeCandlestick.exchange,
                        'symbol': exchangeCandlestick.symbol,
                        'period': exchangeCandlestick.period,
                        'time': exchangeCandlestick.time,
                        'open': exchangeCandlestick.open,
                        'high': exchangeCandlestick.high,
                        'low': exchangeCandlestick.low,
                        'close': exchangeCandlestick.close,
                        'volume': exchangeCandlestick.volume
                    };

                    insert.run(parameters);
                    update.run(parameters);
                })
            })();

            resolve()
        })
    }
}
