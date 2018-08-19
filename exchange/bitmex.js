'use strict';

let Candlestick = require('./../dict/candlestick.js');
let Ticker = require('./../dict/ticker.js');
let Orderbook = require('./../dict/orderbook.js');

let CandlestickEvent = require('./../event/candlestick_event.js');
let TickerEvent = require('./../event/ticker_event.js');
let OrderbookEvent = require('./../event/orderbook_event.js');

let moment = require('moment')
const request = require('request');

const BitMEXClient = require('bitmex-realtime-api');

module.exports = class Exchange {
    constructor(eventEmitter, symbols) {
        let client = new BitMEXClient();

        client.on('error', console.error);
        client.on('open', () => console.log('Bitmex: Connection opened.'));
        client.on('close', () => console.log('Bitmex: Connection closed.'));

        symbols.forEach(function (symbol) {
            symbol['periods'].forEach(function (time) {
                console.log('https://www.bitmex.com/api/v1/trade/bucketed?binSize=' + time + '&partial=false&symbol=' + symbol['symbol'] + '&count=500&reverse=true')
                request('https://www.bitmex.com/api/v1/trade/bucketed?binSize=' + time + '&partial=false&symbol=' + symbol['symbol'] + '&count=500&reverse=true', { json: true }, (err, res, body) => {
                    if (err) {
                        console.log(err);
                        return
                    }

                    let sticks = body.map(function(candle) {
                        return new Candlestick(
                            moment(candle['timestamp']).format('X'),
                            candle['open'],
                            candle['high'],
                            candle['low'],
                            candle['close'],
                            candle['volume'],
                        );
                    });

                    eventEmitter.emit('candlestick', new CandlestickEvent('bitmex', symbol['symbol'], time, sticks));
                });

                client.addStream(symbol['symbol'], 'tradeBin' + time, function(candles) {
                    let myCandles = candles.slice();
                    candles.length = 0

                    let sticks = myCandles.map(function(candle) {
                        return new Candlestick(
                            moment(candle['timestamp']).format('X'),
                            candle['open'],
                            candle['high'],
                            candle['low'],
                            candle['close'],
                            candle['volume'],
                        );
                    });

                    eventEmitter.emit('candlestick', new CandlestickEvent('bitmex', symbol['symbol'], time, sticks));
                });
            })


            client.addStream(symbol['symbol'], 'instrument', function(instruments) {
                instruments.forEach(function(instrument) {
                    eventEmitter.emit('ticker', new TickerEvent(
                        'bitmex',
                        symbol['symbol'],
                        new Ticker('bitmex', symbol['symbol'], moment().format('X'), instrument['bidPrice'], instrument['askPrice'])
                    ));
                })
            });

            var lastTime = moment().format('X');

            client.addStream(symbol['symbol'], 'orderBook10', function(books) {
                let s = moment().format('X');

                // throttle orderbook; updated to often
                if ((lastTime - s) > -5) {
                    return;
                }

                lastTime = s;

                books.forEach(function(book) {
                    eventEmitter.emit('orderbook', new OrderbookEvent(
                        'bitmex',
                        symbol['symbol'],
                        new Orderbook(book['bids'].map(function(item) {
                            return {'price': item[0], 'size': item[1]}
                        }), book['asks'].map(function(item) {
                            return {'price': item[0], 'size': item[1]}
                        }))
                    ));
                })
            });
        })
    }
}

