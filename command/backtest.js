'use strict';

let sqlite3 = require('sqlite3').verbose();
let TransactionDatabase = require("sqlite3-transactions").TransactionDatabase;
let Candlestick = require('./../dict/candlestick.js');
let moment = require('moment')
let util = require('util');
let colors = require('colors');;
let percent = require('percent');
let z = require('zero-fill')
let n = require('numbro')

let strategy = require('../strategy/noop')
let events = require('events')

module.exports = class BackTestCommand {
    constructor(exchange, asset, currency, period) {
        this.exchange = exchange
        this.asset = asset
        this.currency = currency
        this.period = period
    }

    execute() {
        let db = new TransactionDatabase(new sqlite3.Database('bot.db'));
        let eventEmitter = new events.EventEmitter();

        eventEmitter.on('onPeriod', (rows) => {
            console.log(rows.join(' '))
        })

        let sql = 'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? order by time DESC LIMIT 500';

        db.all(sql, [this.exchange, this.asset + this.currency, this.period], (err, rows) => {
            if (err) {
                console.log(err);
                return;
            }

            let candles = rows.map((row) => {
                return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
            });

            let reverse = candles.reverse();

            async function visitItem(lookbacks) {
                // https://blog.lavrton.com/javascript-loops-how-to-handle-async-await-6252dd3c795
                await new Promise((resolve) => {
                    strategy.onPeriod(lookbacks.reverse(), (cols) => {
                        let candle = lookbacks[0];

                        let diff = percent.calc(candle.close - candle.open, candle.open, 2);

                        let rows = [
                            moment(candle.time * 1000).format(),
                            candle.volume.grey,
                            z(8, colors.yellow(candle.close), ' '),
                            z(8, diff[diff > 0 ? 'green' : 'red'], ' '),
                        ]

                        rows.push(cols)

                        eventEmitter.emit('onPeriod', [rows])

                        resolve();
                    })
                })
            }

            async function iterate(items){
                for (let i = 0; i < items.length; i++) {
                    await visitItem(reverse.slice(0, i + 1))
                }
            }

            iterate(reverse);
        });
    }
};