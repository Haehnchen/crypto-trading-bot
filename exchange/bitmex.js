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
var crypto = require('crypto')

let BitMEXClient = require('bitmex-realtime-api');
let Position = require('../dict/position.js');
let ExchangeOrder = require('../dict/exchange_order');

let orderUtil = require('../utils/order_util');

module.exports = class Bitmex {
    constructor(eventEmitter, logger) {
        this.eventEmitter = eventEmitter
        this.logger = logger
        this.apiKey = undefined
        this.apiSecret = undefined
        this.tickSizes = {}
    }

    start(config, symbols) {
        let eventEmitter = this.eventEmitter
        let logger = this.logger
        let tickSizes = this.tickSizes

        this.positions = {}
        this.orders = {}

        let client = new BitMEXClient({
            'apiKeyID': this.apiKey = config.key,
            'apiKeySecret': this.apiSecret = config.secret,
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
                    tickSizes[symbol['symbol']] = instrument['tickSize']

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
                let ourOrders = {}

                Bitmex.createOrders(orders).filter(order => order.status === 'open').forEach(order => {
                    ourOrders[order.id] = order
                })

                this.orders = ourOrders
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
        return new Promise(resolve => {
            let orders = []

            for (let key in this.orders){
                if (this.orders[key].status === 'open') {
                    orders.push(this.orders[key])
                }
            }

            resolve(orders)
        })
    }

    getOrdersForSymbol(symbol) {
        return new Promise(resolve => {
            let orders = []

            for(let key in this.orders){
                let order = this.orders[key];

                if(order.status === 'open' && order.symbol === symbol) {
                    orders.push(order)
                }
            }

            resolve(orders)
        })
    }

    getPositions() {
        return new Promise(resolve => {
            let results = []

            for (let x in this.positions) {
                results.push(this.positions[x])
            }

            resolve(results)
        })
    }

    getPositionForSymbol(symbol) {
        return new Promise(resolve => {

            for (let x in this.positions) {
                let position = this.positions[x];

                if(position.symbol === symbol) {
                    resolve(position)
                    return
                }
            }

            return resolve()
        })
    }

    formatPrice(price, symbol) {
        if (!(symbol in this.tickSizes)) {
            return undefined
        }

        return orderUtil.caluclateIncrementSize(price, this.tickSizes[symbol])
    }

    getName() {
        return 'bitmex'
    }

    order(order) {
        if (!order.amount && !order.price && !order.symbol) {
            throw 'Invalid amount for update'
        }

        let orderType = undefined
        if (!order.type) {
            orderType = 'Limit'
        } else if(order.type === 'limit') {
            orderType = 'Limit'
        } else if(order.type === 'stop') {
            orderType = 'Stop'
        }

        if (!orderType) {
            throw 'Invalid order type'
        }

        var verb = 'POST',
            path = '/api/v1/order',
            expires = new Date().getTime() + (60 * 1000) // 1 min in the future
        ;

        let data = {
            'symbol': order.symbol,
            'orderQty': order.amount,
            'ordType': orderType,
            'text':	'Powered by your awesome crypto-bot watchdog',
        }

        if (orderType === 'Stop') {
            data['stopPx'] = Math.abs(order.price)
        } else {
            data['price'] = Math.abs(order.price)
        }

        data['side'] = order.price < 0 ? 'Sell' : 'Buy'

        if (order.id) {
            data['clOrdID'] = order.id
        }

        var postBody = JSON.stringify(data);
        var signature = crypto.createHmac('sha256', this.apiSecret).update(verb + path + expires + postBody).digest('hex');

        var headers = {
            'content-type' : 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'api-expires': expires,
            'api-key': this.apiKey,
            'api-signature': signature
        }

        let logger = this.logger
        return new Promise((resolve, reject) => {
            request({
                headers: headers,
                url:'https://www.bitmex.com' + path,
                method: verb,
                body: postBody
            }, (error, response, body) => {
                if (error) {
                    logger.error('Bitmex: Invalid order update request:' + JSON.stringify({'error': error, 'body': body}))
                    console.log(error)
                    reject()

                    return
                }

                logger.info('Bitmex: Order created:' + JSON.stringify({'body': body}))

                let order = JSON.parse(body)
                if (order.error) {
                    logger.error('Bitmex: Invalid order created request:' + JSON.stringify(order))
                    console.log(body)
                    reject()
                    return
                }

                console.log(order)

                resolve(Bitmex.createOrders([order])[0])
            })
        })
    }

    updateOrder(id, order) {
        if (!order.amount && !order.price) {
            throw 'Invalid amount for update'
        }

        var verb = 'PUT',
            path = '/api/v1/order',
            expires = new Date().getTime() + (60 * 1000) // 1 min in the future
        ;

        let data = {
            'orderID': id,
            'text':	'Powered by your awesome crypto-bot watchdog',
        }

        if (order.amount) {
            data['orderQty'] = Math.abs(order.amount)
        }

        if (order.price) {
            data['price'] = order.price
        }

        var postBody = JSON.stringify(data);
        var signature = crypto.createHmac('sha256', this.apiSecret).update(verb + path + expires + postBody).digest('hex');

        var headers = {
            'content-type' : 'application/json',
            'Accept': 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'api-expires': expires,
            'api-key': this.apiKey,
            'api-signature': signature
        }

        let logger = this.logger
        return new Promise((resolve, reject) => {
            request({
                headers: headers,
                url:'https://www.bitmex.com' + path,
                method: verb,
                body: postBody
            }, (error, response, body) => {
                if (error) {
                    logger.error('Bitmex: Invalid order update request:' + JSON.stringify({'error': error, 'body': body}))
                    console.log(error)
                    reject()

                    return
                }

                let order = JSON.parse(body)

                if (order.error) {
                    logger.error('Bitmex: Invalid order update request:' + JSON.stringify(order))
                    console.log(body)
                    reject()
                    return
                }

                logger.info('Bitmex: Order update:' + JSON.stringify({'body': body}))

                resolve(Bitmex.createOrders([order])[0])
            })
        })
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
                position['avgEntryPrice']
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
            } else if (orderStatus === 'canceled') {
                status = 'canceled'
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

            let price = order['price']
            if (orderType === 'stop') {
                price = order['stopPx']
            }

            return new ExchangeOrder(
                order['orderID'],
                order['symbol'],
                status,
                price,
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
