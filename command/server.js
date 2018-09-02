'use strict';

let sqlite3 = require('sqlite3').verbose();
let TransactionDatabase = require("sqlite3-transactions").TransactionDatabase;
let events = require('events')
let fs = require('fs');
let Bitfinex = require('../exchange/bitfinex.js');
let Bitmex = require('../exchange/bitmex.js');
const express = require('express')
let Candlestick = require('./../dict/candlestick.js');
const ta = require('../utils/technical_analysis');
let Ticker = require('../dict/ticker');

module.exports = class ServerCommand {
    constructor(instance, config) {
        this.instance = instance
        this.config = config
    }

    execute() {
        let db = new TransactionDatabase(new sqlite3.Database('bot.db'));
        db.configure("busyTimeout", 4000)

        let instances = JSON.parse(fs.readFileSync('./instance.json', 'utf8'));
        let config = JSON.parse(fs.readFileSync('./conf.json', 'utf8'));

        let Twig = require("twig"),
            express = require('express'),
            app = express();

        app.set("twig options", {
            allow_async: true, // Allow asynchronous compiling
            strict_variables: false
        });


        app.use(express.static(__dirname + '/../web/static'))
        app.get('/', function(req, res) {

        let promises = [];

        let periods = ['15m', '1h'];

        instances['symbols'].forEach((symbol) => {
            periods.forEach((period) => {
                promises.push(new Promise((resolve) => {
                    let sql = 'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? order by time DESC LIMIT 500';

                    db.all(sql, [symbol.exchange, symbol.symbol, period], (err, rows) => {
                        if (err) {
                            console.log(err);
                            resolve();
                            return;
                        }

                        let candles = rows.map((row) => {
                            return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
                        });

                        if(candles.length === 0) {
                            resolve();
                            return;
                        }

                        ta.getIndicatorsLookbacks(candles.slice().reverse()).then((result) => {
                            resolve({
                                'symbol': symbol.symbol,
                                'period': period,
                                'ta': result,
                                'ticker': new Ticker(symbol.exchange, symbol.symbol, undefined, candles[0].close),
                            })
                        })
                    });
                }))
            })
        })

        Promise.all(promises)
            .then(values => {
                let v = values.filter((value) => {
                    return value !== undefined
                });

                let x = {}

                v.forEach((v) => {
                    if(!x[v.symbol]) {
                        x[v.symbol] = {
                            'symbol': v.symbol,
                            'ticker': v.ticker,
                            'ta': {},
                        }
                    }

                    // flat indicator list
                    let values = {}
                    for (let key in v.ta) {
                        values[key] = v.ta[key].slice(-1)[0]
                    }

                    console.log(x[v.symbol]['ta'])

                    x[v.symbol]['ta'][v.period] = values
                })

                res.render('../templates/base.html.twig', {
                    rows: x,
                    periods: periods,
                });
            });
        });

        app.listen(8080);
    }
};