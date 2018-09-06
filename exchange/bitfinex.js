'use strict';

const BFX = require('bitfinex-api-node')

let Candlestick = require('./../dict/candlestick.js');
let Ticker = require('./../dict/ticker.js');
let Orderbook = require('./../dict/orderbook.js');
let Position = require('../dict/position.js');

let CandlestickEvent = require('./../event/candlestick_event.js');
let TickerEvent = require('./../event/ticker_event.js');
let OrderbookEvent = require('./../event/orderbook_event.js');
let ExchangeOrder = require('../dict/exchange_order');
let ExchangeOrdersEvents = require('../event/exchange_orders_event');
let ExchangeOrderEvents = require('../event/exchange_order_event');

let moment = require('moment')
const request = require('request');

module.exports = class Bitfinex {
    constructor(eventEmitter, config, instances, logger) {
        var bfx = new BFX(config['key'], config['secret'], {version: 2, transform: true, autoOpen: true});
        var ws = this.client = bfx.ws

        this.orders = {}
        this.positions = []

        ws.on('error', function(err) {
            console.log('error')
            console.log(err)
        })

        ws.on('open', function() {
            instances.forEach(function (instance) {

                // candles
                instance.periods.forEach(function (period) {
                    if(period === '1d') {
                        period = period.toUpperCase();
                    }

                    ws.subscribeCandles('t' + instance['symbol'], period);
                })

                // ticker

                ws.subscribeTicker('t' + instance['symbol']);
                //ws.subscribeTrades('t' + instance['symbol'])

                //ws.subscribeOrderBook('t' + instance['symbol']);
            })

            // authenticate
            ws.auth()
        })

        ws.on('ticker', function(pair, ticker) {
            let myPair = pair;

            if (myPair.substring(0, 1) === 't') {
                myPair = myPair.substring(1)
            }

            eventEmitter.emit('ticker', new TickerEvent(
                'bitfinex',
                myPair,
                new Ticker('bitfinex', myPair, moment().format('X'), ticker['BID'], ticker['ASK'])
            ));
        })

        ws.on('candles', function(pair, candles) {
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
                return typeof candle['MTS'] !== 'undefined';
            }).map(function(candle) {
                return new Candlestick(
                    Math.round(candle['MTS'] / 1000),
                    candle['OPEN'],
                    candle['HIGH'],
                    candle['LOW'],
                    candle['CLOSE'],
                    candle['VOLUME'],
                );
            });

            if(sticks.length === 0) {
                console.error('Candle issue: ' + pair)
                return;
            }

            eventEmitter.emit('candlestick', new CandlestickEvent('bitfinex', mySymbol, period.toLowerCase(), sticks));
        })

        var me = this
        ws.on('on', function(orderNew) {
            let order = Bitfinex.createExchangeOrder(orderNew)

            logger.info('order new:' + JSON.stringify(order))

            me.orders[order.id] = order

            console.log(me.orders[order.id])
        })

        ws.on('on-req', function(order) {
            let id = order[0]

            let status = order[6]
            let message = order[7]
            let ourId = order[4][2]

            logger.info('on-req:' + JSON.stringify(order))
            console.log(id, status, message)
        })

        ws.on('ou', function(orderUpdate) {
            let order = Bitfinex.createExchangeOrder(orderUpdate)

            logger.info('Bitfinex: order update:' + JSON.stringify(order) + JSON.stringify(orderUpdate))

            me.orders[order.id] = order
        })

        ws.on('oc', function(orderCancel) {
            let order = Bitfinex.createExchangeOrder(orderCancel)

            logger.info('Bitfinex: order cancel:' + JSON.stringify(order) + JSON.stringify(orderCancel))

            me.orders[order.id] = order
        })

        ws.on('ps', (positions) => {
            logger.debug('Bitfinex: positions:' + JSON.stringify(positions))

            me.positions = Bitfinex.createPositions(positions)
            console.log(me.positions)
        })

        ws.on('pu', (positions) => {
            console.log('!!!!!!!!PU!!!!!!')
            logger.debug('Bitfinex: positions update:' + JSON.stringify(positions))
        })

        ws.on('cs', function() {
            console.log()
        })

        ws.on('os', function(postions) {
            Bitfinex.createExchangeOrders(postions).forEach((order) => {
                me.orders[order.id] = order
            })

            console.log(me.orders)
        })

        ws.on('message', function() {
            //console.log(arguments)
        })
    }

    order(symbol, order) {
        var me = this

        var cid = Math.round(((new Date()).getTime()).toString() * Math.random())

        var amount = order.side === 'buy' ? order.amount : order.amount * -1

        var myOrder = [
            0,
            'on',
            null,
            {
                cid: cid,
                type: 'LIMIT',
                symbol: 't' + symbol,
                amount: String(amount),
                price: String(order.price),
                hidden: 0,
                postonly: 1
            }
        ]

        this.client.submitOrder(myOrder);

        // find current order
        return new Promise((resolve, reject) => {
            var x = 0;

            var intervalID = setInterval(() => {
                let myOrders = []

                for(let key in me.orders){
                    let order1 = me.orders[key];

                    if(order1.ourId = cid) {
                        myOrders.push(order1)
                    }
                }

                if(myOrders.length > 0) {
                    resolve({
                        'order': myOrders[0],
                    })

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

        var myOrder = [
            0,
            'ou',
            null,
            {
                id: id,
                type: 'LIMIT',
                amount: String(amount),
                price: String(order.price),
            }
        ]

        this.client.submitOrder(myOrder);

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
                    resolve({
                        'order': myOrders[0],
                    })

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

        for(let key in this.orders){
            let order = this.orders[key];

            if(order.status === 'active') {
                orders.push(order)
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

        if (order[13] === 'ACTIVE' || order[13].match(/^PARTIALLY FILLED/)) {
            status = 'open'
        } else if (order[13].match(/^EXECUTED/)) {
            status = 'done'
        } else if (order[13] === 'CANCELED') {
            status = 'rejected'
        } else if (order[13] === 'POSTONLY CANCELED') {
            status = 'rejected'
            retry = true
            //order.reject_reason = 'post only'
        }

        let bitfinex_id = order[0]
        let created_at = order[4]
        //let filled_size = n(position[7]).subtract(ws_order[6]).format('0.00000000')
        let bitfinex_status = order[13]
        let price = order[16]
        let price_avg = order[17]

        let symbol = order[3]
        if (symbol.substring(0, 1) === 't') {
            symbol = symbol.substring(1)
        }

        return new ExchangeOrder(
            bitfinex_id,
            symbol,
            status,
            price,
            order[6],
            retry,
            order[2],
            order[6] < 0 ? 'sell' : 'buy'
        )
    }

    static createExchangeOrders(postions) {
        let myOrders = [];
        let me = this

        postions.forEach((position) => {
            myOrders.push(Bitfinex.createExchangeOrder(position))
        })

        return myOrders
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
                position[2]
            )
        })
    }
}

