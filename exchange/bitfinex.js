'use strict';

const BFX = require('bitfinex-api-node')

let Candlestick = require('./../dict/candlestick.js');
let Ticker = require('./../dict/ticker.js');
let Position = require('../dict/position.js');

let CandlestickEvent = require('./../event/candlestick_event.js');
let TickerEvent = require('./../event/ticker_event.js');
let ExchangeOrder = require('../dict/exchange_order');
let OrderUtil = require('../utils/order_util')
const { Order } = require('bfx-api-node-models')

let moment = require('moment')

module.exports = class Bitfinex {
    constructor(eventEmitter, logger, requestClient) {
        this.eventEmitter = eventEmitter
        this.logger = logger
        this.positions = {}
        this.orders = []
        this.requestClient = requestClient
        this.exchangePairs = {}
        this.tickers = {}
    }

    start(config, symbols) {
        let eventEmitter = this.eventEmitter

        let opts = {
            apiKey: config['key'],
            apiSecret: config['secret'],
            version: 2,
            transform: true,
            autoOpen: true,
        };

        let isAuthed = config['key'] && config['secret'] && config['key'].length > 0 && config['secret'].length > 0;
        if (isAuthed) {
            opts['apiKey'] = config['key']
            opts['apiSecret'] = config['secret']
        } else {
            this.logger.info('Bitfinex: Starting as anonymous; no trading possible')
        }

        const ws = this.client = new BFX(opts).ws()

        let myLogger = this.logger

        this.tickers = {}
        this.orders = {}
        this.positions = {}
        this.exchangePairs = {}

        ws.on('error', err => {
            myLogger.error('Bitfinex: error: ' + String(err))
        })

        ws.on('close', () => {
            myLogger.error('Bitfinex: Connection closed')

            ws.open()
        })

        ws.on('open', () => {
            myLogger.debug('Bitfinex: Connection open')

            symbols.forEach(instance => {
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
            if (opts['apiKey'] && opts['apiSecret']) {
                ws.auth()
            }
        })

        ws.on('ticker', (pair, ticker) => {
            let symbol = Bitfinex.formatSymbol(pair)

            eventEmitter.emit('ticker', new TickerEvent(
                'bitfinex',
                symbol,
                me.tickers[symbol] = new Ticker('bitfinex', symbol, moment().format('X'), ticker['bid'], ticker['ask'])
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

        let me = this

        if (isAuthed) {
            setInterval(function f() {
                me.syncSymbolDetails()
                return f
            }(), 60 * 60 * 30 * 1000)
        }

        ws.onOrderUpdate({}, order => {
            me.onOrderUpdate(order)
        })

        ws.onOrderNew({}, order => {
            me.onOrderUpdate(order)
        })

        ws.onOrderClose({}, order => {
            me.onOrderUpdate(order)
        })

        ws.onOrderSnapshot({}, orders => {
            let marginOrder = orders.filter(order =>
                !order.type.toLowerCase().includes('exchange')
            )

            Bitfinex.createExchangeOrders(marginOrder).forEach(order => {
                me.orders[order.id] = order
            })
        })

        ws.onPositionSnapshot({}, positions => {
            me.onPositions(positions)
        })

        ws.onPositionUpdate({}, position => {
            me.onPositionUpdate(position)
        })

        ws.onPositionNew({}, position => {
            me.onPositionUpdate(position)
        })

        ws.onPositionClose({}, position => {
            me.onPositionUpdate(position)
        })

        ws.open()
    }

    getName() {
        return 'bitfinex'
    }

    /**
     * Position events from websocket: New, Update, Delete
     */
    onPositionUpdate(position) {
        if (position.status && position.status.toLowerCase() === 'closed') {
            delete this.positions[Bitfinex.formatSymbol(position.symbol)]
            return
        }

        let myPositions = Bitfinex.createPositions([position])

        if (myPositions.length > 0) {
            this.positions[myPositions[0].symbol] = myPositions[0]
        }
    }

    onPositions(positions) {
        let myPositions = {}

        Bitfinex.createPositions(positions).forEach(position => {
            myPositions[position.symbol] = position
        })

        this.positions = myPositions
    }

    /**
     * Order events from websocket: New, Update, Delete
     */
    onOrderUpdate(orderUpdate) {
        if (orderUpdate.type.toLowerCase().includes('exchange')) {
            return
        }

        let order = Bitfinex.createExchangeOrder(orderUpdate)

        this.logger.info('Bitfinex: order update: ' + JSON.stringify(order))
        this.orders[order.id] = order
    }

    async order(order) {
        let result = await new Order(Bitfinex.createOrder(order)).submit(this.client)

        let executedOrder = Bitfinex.createExchangeOrder(result)
        this.triggerOrder(executedOrder)

        return executedOrder
    }

    async updateOrder(id, order) {
        let amount = order.side === 'buy' ? order.amount : order.amount * -1

        let changes = {
            'id': id,
        }

        if (order.amount) {
            changes['amount'] = String(amount)
        }

        if (order.price) {
            changes['price'] = String(Math.abs(order.price))
        }

        let result
        try {
            result = await this.client.updateOrder(changes)
        } catch (e) {
            this.logger.error('Bitfinex: error updating order: ' + JSON.stringify([id, order]))
            throw e
        }

        let unseralized = Order.unserialize(result)

        let executedOrder = Bitfinex.createExchangeOrder(unseralized)
        this.triggerOrder(executedOrder)

        return executedOrder
    }

    async getOrders() {
        let orders = []

        for (let key in this.orders){
            if (this.orders[key].status === 'open') {
                orders.push(this.orders[key])
            }
        }

        return orders
    }

    async getOrdersForSymbol(symbol) {
        let orders = []

        for (let key in this.orders){
            let order = this.orders[key];

            if(order.status === 'open' && order.symbol === symbol) {
                orders.push(order)
            }
        }

        return orders
    }

    /**
     * LTC: 0.008195 => 0.00820
     *
     * @param price
     * @param symbol
     * @returns {*}
     */
    calculatePrice(price, symbol) {
        let size = (!(symbol in this.exchangePairs) || !this.exchangePairs[symbol].tick_size)
            ? '0.001'
            : this.exchangePairs[symbol].tick_size

        return OrderUtil.calculateNearestSize(price, size)
    }

    /**
     * LTC: 0.65 => 1
     *
     * @param amount
     * @param symbol
     * @returns {*}
     */
    calculateAmount(amount, symbol) {
        let size = (!(symbol in this.exchangePairs) || !this.exchangePairs[symbol].lot_size)
            ? '0.001'
            : this.exchangePairs[symbol].lot_size

        return OrderUtil.calculateNearestSize(amount, size)
    }

    async getPositions() {
        let positions = []

        for (let symbol in this.positions) {
            let position = this.positions[symbol]

            if (position.entry && this.tickers[position.symbol]) {
                if (position.side === 'long') {
                    position = Position.createProfitUpdate(position, ((this.tickers[position.symbol].bid / position.entry) - 1) * 100)
                } else if (position.side === 'short') {
                    position = Position.createProfitUpdate(position, ((position.entry / this.tickers[position.symbol].ask ) - 1) * 100)
                }
            }

            positions.push(position)
        }

        return positions
    }

    getPositionForSymbol(symbol) {
        return new Promise(resolve => {
            for (let key in this.positions) {
                let position = this.positions[key];

                if (position.symbol === symbol) {
                    resolve(position)
                    return
                }
            }

            return resolve()
        })
    }

    async cancelOrder(id) {
        let order = await this.findOrderById(id)
        if (!order) {
            return
        }

        let result
        try {
            result = await this.client.cancelOrder(id)
        } catch (e) {
            this.logger.error('Bitfinex: cancel order error: ' + e)
            return
        }

        delete this.orders[id]

        return ExchangeOrder.createCanceled(order)
    }

    findOrderById(id) {
        return new Promise(async resolve => {
            resolve((await this.getOrders()).find(order =>
                order.id === id || order.id == id
            ))
        })
    }

    async cancelAll(symbol) {
        let orders = []

        for (let order of (await this.getOrdersForSymbol(symbol))) {
            orders.push(await this.cancelOrder(order.id))
        }

        return orders
    }

    async syncSymbolDetails() {
        this.logger.debug('Bitfinex: Sync symbol details')

        let result = await this.requestClient.executeRequestRetry({
            url: 'https://api.bitfinex.com/v1/symbols_details',
            headers: {
                'Content-Type' : 'application/json',
                'Accept': 'application/json',
            },
        }, result => {
            return result.response.statusCode >= 500
        })

        let exchangePairs = {}

        JSON.parse(result.body).filter(product => product.margin === true).forEach(product => {
            let min_size = parseFloat(product.minimum_order_size)
            let prec = 0

            if (min_size > 130 ) {
                prec = 4
            } else if (min_size > 30) {
                prec = 3
            } else if (min_size > 1) {
                prec = 2
            } else if (min_size > 0.1) {
                prec = 1
            }

            let increment = '0.' + '0'.repeat(prec + product.price_precision - (product.pair.substring(3, 6).toUpperCase() == 'USD' ? 3 : 0)) + '1'

            exchangePairs[product.pair.substring(0, 3).toUpperCase()] = {
                lot_size: increment,
                tick_size: increment,
            }
        })

        this.exchangePairs = exchangePairs
    }

    /**
     * Force an order update only if order is "not closed" for any reason already by exchange
     *
     * @param order
     */
    triggerOrder(order) {
        if (!(order instanceof ExchangeOrder)) {
            throw 'Invalid order given'
        }

        // dont overwrite state closed order
        if (order.id in this.orders && ['done', 'canceled'].includes(this.orders[order.id].status)) {
            delete this.orders[order.id]
            return
        }

        this.orders[order.id] = order
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

        let orderType = undefined
        switch (order.type.toLowerCase()) {
            case 'limit':
                orderType = 'limit'
                break;
            case 'stop':
                orderType = 'stop'
                break;
        }

        let orderValues = {}
        if (order['_fieldKeys']) {
            order['_fieldKeys'].map(k => {
                orderValues[k] = order[k];
            })
        }

        return new ExchangeOrder(
            bitfinex_id,
            Bitfinex.formatSymbol(order['symbol']),
            status,
            price,
            order['amount'],
            retry,
            order['cid'],
            order['amount'] < 0 ? 'sell' : 'buy',
            orderType,
            new Date(order['mtsUpdate']),
            new Date(),
            orderValues
        )
    }

    static createExchangeOrders(orders) {
        return orders.map(Bitfinex.createExchangeOrder)
    }

    static createOrder(order) {
        let amount = Math.abs(order.amount);

        let orderOptions = {
            cid: order.id,
            symbol: 't' + order.symbol,
            amount: order.price < 0 ? amount * -1 : amount,
        }

        if (!order.type || order.type === 'limit') {
            orderOptions['type'] = Order.type.LIMIT
            orderOptions['price'] = String(Math.abs(order.price))
        } else if(order.type === 'stop') {
            orderOptions['type'] = Order.type.STOP
            orderOptions['price'] = String(Math.abs(order.price))
        } else if(order.type === 'market') {
            orderOptions['type'] = Order.type.MARKET
        }

        let myOrder = new Order(orderOptions)

        if (order.options && order.options.post_only === true) {
            myOrder.setPostOnly(true)
        }

        if (order.options && order.options.close === true && orderOptions['type'] && orderOptions['type'] === Order.type.STOP) {
            myOrder.setReduceOnly(true)
        }

        return myOrder
    }

    static createPositions(positions) {
        return positions.filter(position => {
            return position.status.toLowerCase() === 'active'
        }).map(position => {
            return new Position(
                Bitfinex.formatSymbol(position.symbol),
                position.amount < 0 ? 'short' : 'long',
                position.amount,
                undefined,
                new Date(),
                position.basePrice,
                new Date(),
            )
        })
    }

    static formatSymbol(symbol) {
        return symbol.substring(0, 1) === 't'
            ? symbol.substring(1)
            : symbol
    }

}
