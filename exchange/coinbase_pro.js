'use strict';

const Gdax = require('gdax');

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let CandlestickEvent = require('./../event/candlestick_event')
let TickerEvent = require('./../event/ticker_event')
let OrderUtil = require('../utils/order_util')
let ExchangeOrder = require('../dict/exchange_order')

let moment = require('moment')

module.exports = class CoinbasePro {
    constructor(eventEmitter, logger) {
        this.eventEmitter = eventEmitter
        this.logger = logger
        this.client = undefined
        this.orders = {}
        this.exchangePairs = {}
        this.symbols = {}
        this.positions = {}
    }

    start(config, symbols) {
        let eventEmitter = this.eventEmitter
        let logger = this.logger

        let wsAuth = {}

        if (config['key'] && config['secret'] && config['passphrase'] && config['key'].length > 0 && config['secret'].length > 0 && config['passphrase'].length > 0) {
            this.client = this.client = new Gdax.AuthenticatedClient(
                config['key'],
                config['secret'],
                config['passphrase'],
            )

            wsAuth = {
                key: config['key'],
                secret: config['secret'],
                passphrase: config['passphrase'],
            }

            this.logger.info('Coinbase Pro: Using AuthenticatedClient')
        } else {
            this.client = new Gdax.PublicClient()
            this.logger.info('Coinbase Pro: Using PublicClient')
        }

        const websocket = new Gdax.WebsocketClient(
            symbols.map(s => s.symbol),
            undefined,
            wsAuth,
            { 'channels': ['ticker', 'user']},
        )

        symbols.forEach(symbol => {
            symbol['periods'].forEach(interval => {
                // backfill
                let granularity
                switch (interval) {
                    case '1m':
                        granularity = 60
                        break
                    case '5m':
                        granularity = 300
                        break
                    case '15m':
                        granularity = 900
                        break
                    case '1h':
                        granularity = 3600
                        break
                    default:
                        throw 'Invalid period for gdax'
                }

                this.client.getProductHistoricRates(symbol['symbol'], {granularity: granularity}).then(candles => {
                    let ourCandles = candles.map(candle => {
                        return new Candlestick(
                            candle[0],
                            candle[3],
                            candle[2],
                            candle[1],
                            candle[4],
                            candle[5]
                        )
                    })

                    eventEmitter.emit('candlestick', new CandlestickEvent('coinbase_pro', symbol['symbol'], interval, ourCandles));
                })
            })
        })

        let me = this
        setInterval(function f() {
            me.syncOrders()
            return f
        }(), 1000 * 30)

        websocket.on('message', data => {
            if (data.type && data.type === 'ticker') {
                eventEmitter.emit('ticker', new TickerEvent(
                    this.getName(),
                    data['product_id'],
                    new Ticker(this.getName(), data['product_id'], moment().format('X'), data['best_ask'], data['best_bid'])
                ))
            }
        })

        /*
                let candles = {}
        let lastCandleMap = {}
        websocket.on('message', (msg) => {

            if (!msg.price)
                return;

            if (!msg.size)
                return;

            if (!msg.product_id)
                return;

            // Price and volume are sent as strings by the API
            msg.price = parseFloat(msg.price)
            msg.size = parseFloat(msg.size)

            let productId = msg.product_id
            let [base, quote] = productId.split('-')

            // Round the time to the nearest minute, Change as per your resolution
            let roundedTime = Math.floor(new Date(msg.time) / 60000.0) * 60

            // If the candles hashmap doesnt have this product id create an empty object for that id
            if (!candles[productId]) {
                candles[productId] = {}
            }


            // If the current product's candle at the latest rounded timestamp doesnt exist, create it
            if (!candles[productId][roundedTime]) {

                //Before creating a new candle, lets mark the old one as closed
                let lastCandle = lastCandleMap[productId]

                if (lastCandle) {
                    lastCandle.closed = true;
                    delete candles[productId][lastCandle.timestamp]
                }

                // Set Quote Volume to -1 as GDAX doesnt supply it
                candles[productId][roundedTime] = {
                    timestamp: roundedTime,
                    open: msg.price,
                    high: msg.price,
                    low: msg.price,
                    close: msg.price,
                    baseVolume: msg.size,
                    quoteVolume: -1,
                    closed: false
                }
            }

            // If this timestamp exists in our map for the product id, we need to update an existing candle
            else {
                let candle = candles[productId][roundedTime]
                candle.high = msg.price > candle.high ? msg.price : candle.high
                candle.low = msg.price < candle.low ? msg.price : candle.low
                candle.close = msg.price
                candle.baseVolume = parseFloat((candle.baseVolume + msg.size).toFixed(8))

                // Set the last candle as the one we just updated
                lastCandleMap[productId] = candle
            }
        })
        */

        websocket.on('error', err => {
            this.logger.error('Coinbase Pro: Error ' + String(err))
        })

        websocket.on('close', () => {
            this.logger.info('Coinbase Pro: Connected')
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

    findOrderById(id) {
        return new Promise(async resolve => {
            resolve((await this.getOrders()).find(order =>
                order.id === id
            ))
        })
    }

    getOrdersForSymbol(symbol) {
        return new Promise(async resolve => {
            resolve((await this.getOrders()).filter(order => order.symbol === symbol))
        })
    }

    /**
     * LTC: 0.008195 => 0.00820
     *
     * @param price
     * @param symbol
     * @returns {*}
     */
    calculatePrice(price, symbol) {
        if (!(symbol in this.exchangePairs) || !this.exchangePairs[symbol].tick_size) {
            return undefined
        }

        return OrderUtil.calculateNearestSize(price, this.exchangePairs[symbol].tick_size)
    }

    /**
     * LTC: 0.65 => 1
     *
     * @param amount
     * @param symbol
     * @returns {*}
     */
    calculateAmount(amount, symbol) {
        if (!(symbol in this.exchangePairs) || !this.exchangePairs[symbol].lot_size) {
            return undefined
        }

        return OrderUtil.calculateNearestSize(amount, this.exchangePairs[symbol].lot_size)
    }

    getPositions() {
        return new Promise(async resolve => {
            let results = []

            for (let x in this.positions) {
                results.push(this.positions[x])
            }

            resolve(results)
        })
    }

    getPositionForSymbol(symbol) {
        return new Promise(async resolve => {
            for (let position of (await this.getPositions())) {
                if(position.symbol === symbol) {
                    resolve(position)
                    return
                }
            }

            resolve()
        })
    }

    async syncOrders() {
        let ordersRaw = []

        try {
            ordersRaw = await this.client.getOrders({status: 'open'})
        } catch (e) {
            this.logger.error('Coinbase Pro:' + String(e))
            return
        }

        let orders = {}
        CoinbasePro.createOrders(...ordersRaw).forEach(o => {
            orders[o.id] = o
        })

        this.orders = orders
    }

    static createOrders(...orders) {
        return orders.map(order => {
            let retry = false

            let status = undefined
            let orderStatus = order['status'].toLowerCase()

            if (['open', 'active', 'pending'].includes(orderStatus)) {
                status = 'open'
            } else if (orderStatus === 'filled') {
                status = 'done'
            } else if (orderStatus === 'canceled') {
                status = 'canceled'
            } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
                status = 'rejected'
                retry = true
            }

            let ordType = order['type'].toLowerCase();

            // secure the value
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
                order['id'],
                order['product_id'],
                status,
                parseFloat(order.price),
                parseFloat(order.size),
                retry,
                undefined,
                order['side'].toLowerCase() === 'buy' ? 'buy' : 'sell', // secure the value,
                orderType,
                new Date(order['created_at']),
                new Date(),
                order
            )
        })
    }

    getName() {
        return 'coinbase_pro'
    }
}
