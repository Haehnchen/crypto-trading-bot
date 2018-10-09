'use strict';

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let Orderbook = require('./../dict/orderbook')

let CandlestickEvent = require('./../event/candlestick_event')
let TickerEvent = require('./../event/ticker_event')
let OrderbookEvent = require('./../event/orderbook_event')

let resample = require('./../utils/resample')

let moment = require('moment')
const request = require('request');

const BitMEXClient = require('bitmex-realtime-api');

module.exports = class Exchange {
    constructor(eventEmitter, symbols, logger) {
        let client = new BitMEXClient();

        client.on('error', (error) => {
            console.error(error)
            logger.error('Bitmex: error' + JSON.stringify(error))
        })

        client.on('open', () => {
            logger.info('Bitmex: Connection opened.')
            console.log('Bitmex: Connection opened.')
        })

        client.on('close', () => {
            logger.info('Bitmex: Connection closed.')
            console.log('Bitmex: Connection closed.')
        })

        symbols.forEach(symbol => {
            symbol['periods'].forEach(time => {

                let wantPeriod = time
                let resamplePeriod = undefined

                // TODO: provide a period minutes time converter
                if (time === '15m') {
                    wantPeriod = '5m'
                    resamplePeriod = 15
                }

                request('https://www.bitmex.com/api/v1/trade/bucketed?binSize=' + wantPeriod + '&partial=false&symbol=' + symbol['symbol'] + '&count=500&reverse=true', { json: true }, (err, res, body) => {
                    if (err) {
                        console.log(err)
                        logger.error('Bitmex candle backfill error: ' + err)
                        return
                    }

                    if(!Array.isArray(body)) {
                        console.log(body);
                        logger.error('Bitmex candle backfill error: ' + JSON.stringify(body))
                        return
                    }

                    let sticks = body.map(candle => {
                        return new Candlestick(
                            moment(candle['timestamp']).format('X'),
                            candle['open'],
                            candle['high'],
                            candle['low'],
                            candle['close'],
                            candle['volume'],
                        )
                    })

                    if (resamplePeriod) {
                        sticks = resample.resampleMinutes(sticks, resamplePeriod)
                    }

                    eventEmitter.emit('candlestick', new CandlestickEvent('bitmex', symbol['symbol'], time, sticks));
                });

                client.addStream(symbol['symbol'], 'tradeBin' + wantPeriod, (candles) => {
                    // we need a force reset; candles are like queue
                    let myCandles = candles.slice();
                    candles.length = 0

                    let sticks = myCandles.map(candle => {
                        return new Candlestick(
                            moment(candle['timestamp']).format('X'),
                            candle['open'],
                            candle['high'],
                            candle['low'],
                            candle['close'],
                            candle['volume'],
                        );
                    });

                    if (resamplePeriod) {
                        sticks = resample.resampleMinutes(sticks, resamplePeriod)
                    }

                    eventEmitter.emit('candlestick', new CandlestickEvent('bitmex', symbol['symbol'], time, sticks));
                })
            })

            client.addStream(symbol['symbol'], 'instrument', (instruments) => {
                instruments.forEach((instrument) => {
                    eventEmitter.emit('ticker', new TickerEvent(
                        'bitmex',
                        symbol['symbol'],
                        new Ticker('bitmex', symbol['symbol'], moment().format('X'), instrument['bidPrice'], instrument['askPrice'])
                    ));
                })
            })

            /*
            Disable: huge traffic with no use case right now
            var lastTime = moment().format('X');

            client.addStream(symbol['symbol'], 'orderBook10', (books) => {
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
            */

        })
    }
}

