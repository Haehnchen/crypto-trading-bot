'use strict';

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let Orderbook = require('./../dict/orderbook')

let CandlestickEvent = require('./../event/candlestick_event')
let TickerEvent = require('./../event/ticker_event')
let OrderbookEvent = require('./../event/orderbook_event')

let resample = require('./../utils/resample')

let moment = require('moment')
let request = require('request');

let BitMEXClient = require('bitmex-realtime-api');
let Position = require('../dict/position.js');
let ExchangeOrder = require('../dict/exchange_order');

module.exports = class Bitmex {
    constructor(eventEmitter, symbols, config, logger) {
        this.positions = {}
        this.orders = {}

        let client = new BitMEXClient({
            'apiKeyID': config.key,
            'apiKeySecret': config.secret,
        })

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
                    ))
                })
            })

            /*
             * This stream alerts me of any change to the orders. If it is filled, closed, etc...
             */
            client.addStream(symbol['symbol'], 'order', (orders, symbol, tableName) => {
                Bitmex.createOrders(orders).forEach(order => {
                    this.orders[order.id] = order
                })
            })

            /*
             * This stream alerts me of any change to my positions. If it is filled, closed, entry price, liquidation price
             */
            client.addStream(symbol['symbol'], 'position', (positions, symbol, tableName) => {
                Bitmex.createPositions(positions).forEach(position => {
                    this.positions[position.symbol] = position
                })
            })

            /*
             * This stream alerts me of any executions of my orders. The results of the executions are seen in the postions stream

            client.addStream(symbol['symbol'], 'execution', (data, symbol, tableName) => {
            })
             */

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

    getOrders() {
        let orders = []

        for(let key in this.orders){
            orders.push(this.orders[key])
        }

        return orders
    }

    getOrdersForSymbol(symbol) {
        let orders = []

        for(let key in this.orders){
            let order = this.orders[key];

            if(order.status === 'open' && order.symbol === symbol) {
                orders.push(order)
            }
        }

        return orders
    }

    getPositions() {
        let results = []

        for (let x in this.positions) {
            results.push(this.positions[x])
        }

        return results
    }

    getPositionForSymbol(symbol) {
        for (let x in this.positions) {
            let position = this.positions[x];

            if(position.symbol === symbol) {
                return position
            }
        }

        return undefined
    }

    getName() {
        return 'bitmex'
    }

    static createPositions(positions) {
        return positions.filter((position) => {
            return position['isOpen'] === true
        }).map(position => {
            return new Position(
                position['symbol'],
                position['currentQty'] < 0 ? 'short' : 'long',
                position['currentQty'],
                position['unrealisedRoePcnt']  * 100,
                new Date(),
            )
        })
    }

    static createOrders(orders) {
        return orders.map(order => {
            let retry = false

            /*
            match execType with
                | "New" -> `Open, `New_order_accepted
            | "PartiallyFilled" -> `Open, `Partially_filled
            | "Filled" -> `Filled, `Filled
            | "DoneForDay" -> `Open, `General_order_update
            | "Canceled" -> `Canceled, `Canceled
            | "PendingCancel" -> `Pending_cancel, `General_order_update
            | "Stopped" -> `Open, `General_order_update
            | "Rejected" -> `Rejected, `New_order_rejected
            | "PendingNew" -> `Pending_open, `General_order_update
            | "Expired" -> `Rejected, `New_order_rejected
            | _ -> invalid_arg' execType ordStatus
            */

            let status = 'open'
            let orderStatus = order['ordStatus'].toLowerCase()

            if (orderStatus === 'new' || orderStatus === 'partiallyfilled' || orderStatus === 'pendingnew') {
                status = 'open'
            } else if (orderStatus === 'filled') {
                status = 'done'
            } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
                status = 'rejected'
                retry = true
            }

            let ordType = order['ordType'].toLowerCase();

            let orderType = undefined
            switch (ordType) {
                case 'limit':
                    orderType = 'limit'
                    break;
                case 'stop':
                    orderType = 'stop'
                    break;
            }

            return new ExchangeOrder(
                order['orderID'],
                order['symbol'],
                status,
                order['price'],
                order['orderQty'],
                retry,
                order['clOrdID'],
                order['side'].toLowerCase() === 'sell' ? 'sell' : 'buy', // secure the value,
                orderType,
                new Date(order['transactTime']),
                new Date()
            )
        })
    }
}
