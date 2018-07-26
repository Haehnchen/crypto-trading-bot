'use strict';

let sqlite3 = require('sqlite3').verbose();
let TransactionDatabase = require("sqlite3-transactions").TransactionDatabase;
let events = require('events')
let fs = require('fs');
let Bitfinex = require('../exchange/bitfinex.js');
let Bitmex = require('../exchange/bitmex.js');

module.exports = class TradeCommand {
    constructor(instance, config) {
        this.instance = instance
        this.config = config
    }

    execute() {
        let eventEmitter = new events.EventEmitter();

        let obj = JSON.parse(fs.readFileSync('./instance.json', 'utf8'));
        let config = JSON.parse(fs.readFileSync('./conf.json', 'utf8'));

        let db = new TransactionDatabase(new sqlite3.Database('bot.db'));
        db.configure("busyTimeout", 4000)

        let filter = obj.symbols.filter(function (symbol) {
            return symbol['exchange'] === 'bitmex' && symbol['state'] === 'watch';
        });

        if(filter.length > 0) {
            let exchange = new Bitmex(eventEmitter, filter);
        }

        let filter2 = obj.symbols.filter(function (symbol) {
            return symbol['exchange'] === 'bitfinex' && symbol['state'] === 'watch';
        });

        if(filter2.length > 0) {
            let exchange = new Bitfinex(eventEmitter, config.exchanges.bitfinex, filter2);

            /*
            setTimeout(function(){
                console.log('order')
                exchange.order()
            }, 5000);
            */

        }

        eventEmitter.on('candlestick', function(candleStickEvent) {
            db.beginTransaction(function(err, transaction) {
                candleStickEvent.candles.forEach(function (candle) {
                    let s = "" +
                        "REPLACE INTO candlesticks(exchange, symbol, period, time, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ";

                    db.run(s, [
                        candleStickEvent.exchange,
                        candleStickEvent.symbol,
                        candleStickEvent.period,
                        candle.time,
                        candle.open,
                        candle.high,
                        candle.low,
                        candle.close,
                        candle.volume,
                    ]);
                })

                transaction.commit(function(err) {
                    if (err) {
                        return console.log("Sad panda :-( commit() failed.", err);
                    }
                });
            });

        });

        eventEmitter.on('ticker', function(tickerEvent) {
            console.log(tickerEvent)
        });

        eventEmitter.on('orderbook', function(orderbookEvent) {
            //console.log(orderbookEvent.orderbook)
        });
    }
};