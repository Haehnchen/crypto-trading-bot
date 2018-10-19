'use strict';

const BFX = require('bitfinex-api-node')

let Candlestick = require('./../dict/candlestick.js');
let Ticker = require('./../dict/ticker.js');
let Position = require('../dict/position.js');

let CandlestickEvent = require('./../event/candlestick_event.js');
let TickerEvent = require('./../event/ticker_event.js');
let ExchangeOrder = require('../dict/exchange_order');

let moment = require('moment')

module.exports = class Bitfinex {
    constructor(eventEmitter, config, instances, logger) {
        this.eventEmitter = eventEmitter
        this.logger = logger

        const ws = this.client = new BFX({
            apiKey: config['key'],
            apiSecret: config['secret'],
            version: 2,
            transform: true,
            autoOpen: true,
        }).ws()

        //var ws = this.client = bfx.ws
        let myLogger = logger

        this.orders = {}
        this.positions = []

        ws.on('error', function(err) {
            myLogger.error('Bitfinex: error' + JSON.stringify(err))
        })

        ws.on('close', () => {
            myLogger.error('Bitfinex: Connection closed')

            ws.open()
        })

        ws.on('open', () => {
            myLogger.debug('Bitfinex: Connection open')

            instances.forEach(function (instance) {
                // candles
                instance.periods.forEach(function (period) {
                    if(period === '1d') {
                        period = period.toUpperCase();
                    }

                    ws.subscribeCandles('trade:' + period + ':t' + instance['symbol'])
                })

                // ticker
                ws.subscribeTicker('t' + instance['symbol']);
                //ws.subscribeTrades('t' + instance['symbol'])
                //ws.subscribeOrderBook('t' + instance['symbol']);
            })

            // authenticate
            ws.auth()
        })


        ws.on('ticker', (pair, ticker) => {
            let myPair = pair;

            if (myPair.substring(0, 1) === 't') {
                myPair = myPair.substring(1)
            }

            eventEmitter.emit('ticker', new TickerEvent(
                'bitfinex',
                myPair,
                new Ticker('bitfinex', myPair, moment().format('X'), ticker['bid'], ticker['ask'])
            ));
        })

        ws.on('candle', (candles, pair) => {
            let options = pair.split(':');

            let period = options[1].toLowerCase();
            let mySymbol = options[2];

            if (mySymbol.substring(0, 1) === 't') {
                mySymbol = mySymbol.substring(1)
            }

            let myCandles = [];

            if(Array.isArray(candles)) {
                candles.forEach(function(candle) {
                    myCandles.push(candle)
                })
            } else {
                myCandles.push(candles)
            }

            let sticks = myCandles.filter(function (candle) {
                return typeof candle['mts'] !== 'undefined';
            }).map(function(candle) {
                return new Candlestick(
                    Math.round(candle['mts'] / 1000),
                    candle['open'],
                    candle['high'],
                    candle['low'],
                    candle['close'],
                    candle['volume'],
                );
            });

            if(sticks.length === 0) {
                console.error('Candle issue: ' + pair)
                return;
            }

            eventEmitter.emit('candlestick', new CandlestickEvent('bitfinex', mySymbol, period.toLowerCase(), sticks));
        })

        var me = this

        ws.onOrderUpdate({}, (orderUpdate) => {
            let order = Bitfinex.createExchangeOrder(orderUpdate)

            me.logger.info('Bitfinex: order cancel: ' + JSON.stringify(order))

            me.orders[order.id] = order
        })

        ws.onOrderNew({}, (orderUpdate) => {
            let order = Bitfinex.createExchangeOrder(orderUpdate)

            me.logger.info('Bitfinex: order cancel: ' + JSON.stringify(order))

            me.orders[order.id] = order
        })

        ws.onOrderClose({}, (orderCancel) => {
            let order = Bitfinex.createExchangeOrder(orderCancel)

            me.logger.info('Bitfinex: order cancel: ' + JSON.stringify(order))

            me.orders[order.id] = order
        })

        ws.onOrderSnapshot({}, orders => {
            Bitfinex.createExchangeOrders(orders).forEach(order => {
                me.orders[order.id] = order
            })
        })

        ws.on('ps', (positions) => {
            myLogger.debug('Bitfinex: positions:' + JSON.stringify(positions))

            me.positions = Bitfinex.createPositions(positions)
        })

        ws.on('pu', (positions) => {
            myLogger.debug('Bitfinex: positions update:' + JSON.stringify(positions))
        })

        ws.open()
    }

    getName() {
        return 'bitfinex'
    }

    order(order) {
        var me = this

        var amount = order.side === 'buy' ? order.amount : order.amount * -1

        const o = new BFX.Models.Order({
            cid: order.id,
            symbol: 't' + order.symbol,
            price: order.price,
            amount: amount,
            type: 'LIMIT',
            postonly: true
        }, this.client)

        // find current order
        return new Promise((resolve, reject) => {
            var x = 0;

            o.submit().then(() => {
                console.log('order deployed')
            }).catch((e) => {
                console.log(e)
            })

            var intervalID = setInterval(() => {
                let myOrders = []

                for(let key in me.orders){
                    let order1 = me.orders[key];

                    if(order1.ourId = order.id) {
                        myOrders.push(order1)
                    }
                }

                if(myOrders.length > 0) {
                    resolve(myOrders[0])

                    clearInterval(intervalID)
                    return
                }

                if (++x > 100) {
                    clearInterval(intervalID)
                    console.log('order timeout')
                    reject()
                }
            }, 100);
        });
    }

    updateOrder(id, order) {
        var amount = order.side === 'buy' ? order.amount : order.amount * -1

        this.client.updateOrder({
            'id': id,
            'amount': String(amount),
            'price': String(order.price),
        })

        var me = this

        // find current order
        return new Promise((resolve, reject) => {
            var x = 0;

            var intervalID = setInterval(() => {
                let myOrders = []

                for(let key in me.orders){
                    let order1 = me.orders[key];

                    if(order1.id = id) {
                        myOrders.push(order1)
                    }
                }

                if(myOrders.length > 0) {
                    resolve(myOrders[0])

                    clearInterval(intervalID)
                    return
                }

                if (++x > 10) {
                    clearInterval(intervalID)
                    console.log('order timeout')
                    reject()
                }
            }, 500);
        });
    }

    getOrders() {
        let orders = []

        for (let key in this.orders){
            if (this.orders[key].status === 'open') {
                orders.push(this.orders[key])
            }
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
        return this.positions
    }

    getPositionForSymbol(symbol) {
        for (let key in this.positions) {
            let position = this.positions[key];

            if(position.symbol === symbol) {
                return position
            }
        }

        return undefined
    }

    static createExchangeOrder(order) {
        let status = undefined
        let retry = false

        if (order['status'] === 'ACTIVE' || order['status'].match(/^PARTIALLY FILLED/)) {
            status = 'open'
        } else if (order['status'].match(/^EXECUTED/)) {
            status = 'done'
        } else if (order['status'] === 'CANCELED') {
            status = 'rejected'
        } else if (order['status'] === 'POSTONLY CANCELED') {
            status = 'rejected'
            retry = true
            //order.reject_reason = 'post only'
        }

        let bitfinex_id = order['id']
        let created_at = order['status']
        //let filled_size = n(position[7]).subtract(ws_order[6]).format('0.00000000')
        let bitfinex_status = order['status']
        let price = order['price']
        let price_avg = order['price_avg']

        let symbol = order['symbol']
        if (symbol.substring(0, 1) === 't') {
            symbol = symbol.substring(1)
        }

        let orderType = undefined
        switch (order.type.toLowerCase()) {
            case 'limit':
                orderType = 'limit'
                break;
            case 'stop':
                orderType = 'stop'
                break;
        }

        return new ExchangeOrder(
            bitfinex_id,
            symbol,
            status,
            price,
            order['amount'],
            retry,
            order['cid'],
            order['amount'] < 0 ? 'sell' : 'buy',
            orderType,
            new Date(order['mtsUpdate']),
            new Date()
        )
    }

    static createExchangeOrders(orders) {
        return orders.map(Bitfinex.createExchangeOrder)
    }

    static createPositions(positions) {
        return positions.filter((position) => {
            return position[1].toLowerCase() === 'active'
        }).map((position) => {
            let pair = position[0]
            if (pair.substring(0, 1) === 't') {
                pair = pair.substring(1)
            }

            return new Position(
                pair,
                position[2] < 0 ? 'short' : 'long',
                position[2],
                undefined,
                new Date(),
            )
        })
    }
}


