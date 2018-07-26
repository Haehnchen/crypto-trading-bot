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


        app.get('/', function(req, res) {
        let rows = []
        let promises = [];

        instances['symbols'].forEach((symbol) => {
            ['1h', '1d'].forEach((period) => {
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

                        ta.getIndicatorsForCandleLookbackPeriod(candles, (result) => {
                            resolve({
                                'symbol': symbol.symbol,
                                'period': period,
                                'ta': result,
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

                let x = {};

                v.forEach((v) => {
                    if(!x[v.symbol]) {
                        x[v.symbol] = {
                            'symbol': v.symbol,
                            'ta': {},
                        }
                    }

                    x[v.symbol]['ta'][v.period] = v.ta
                })

                console.log(x)

                res.render('../templates/base.html.twig', {
                    rows: x,
                });
            });
        });

        app.listen(8080);
    }
};