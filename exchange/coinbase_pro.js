'use strict';

const Gdax = require('gdax');

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let CandlestickEvent = require('./../event/candlestick_event')
let TickerEvent = require('./../event/ticker_event')
let OrderUtil = require('../utils/order_util')
let Resample = require('../utils/resample')
let ExchangeOrder = require('../dict/exchange_order')
let Position = require('../dict/position')
let Order = require('../dict/order')
let moment = require('moment')

module.exports = class CoinbasePro {
    constructor(eventEmitter, logger, candlestickResample, queue) {
        this.eventEmitter = eventEmitter
        this.queue = queue
        this.logger = logger
        this.candlestickResample = candlestickResample

        this.client = undefined
        this.orders = {}
        this.exchangePairs = {}
        this.symbols = {}
        this.positions = {}

        this.candles = {}
        this.lastCandleMap = {}
    }

    start(config, symbols) {
        this.symbols = symbols
        this.candles = {}
        this.lastCandleMap = {}

        let eventEmitter = this.eventEmitter

        let wsAuth = {}

        let channels = ['ticker', 'matches'];

        if (config['key'] && config['secret'] && config['passphrase'] && config['key'].length > 0 && config['secret'].length > 0 && config['passphrase'].length > 0) {
            // for user related websocket actions
            channels.push('user')

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
            { 'channels': channels},
        )

        symbols.forEach(symbol => {
            symbol['periods'].forEach(interval => this.queue.add(async () => {
                // backfill
                let granularity = Resample.convertPeriodToMinute(interval) * 60

                let candles
                try {
                    candles = await this.client.getProductHistoricRates(symbol['symbol'], {granularity: granularity})
                } catch (e) {
                    me.logger.error('Coinbase Pro: candles fetch error: ' + JSON.stringify([symbol['symbol'], interval, String(e)]))
                    return
                }

                let ourCandles = candles.map(candle =>
                    new Candlestick(
                        candle[0],
                        candle[3],
                        candle[2],
                        candle[1],
                        candle[4],
                        candle[5]
                    )
                )

                eventEmitter.emit('candlestick', new CandlestickEvent('coinbase_pro', symbol['symbol'], interval, ourCandles));
            }))
        })

        let me = this
        setInterval(function f() {
            me.syncOrders()
            return f
        }(), 1000 * 30)

        setInterval(function f() {
            me.syncBalances()
            return f
        }(), 1000 * 30)

        setInterval(function f() {
            me.syncPairInfo()
            return f
        }(), 60 * 60 * 15 * 1000);

        websocket.on('message', async data => {
            if (data.type && data.type === 'ticker') {
                eventEmitter.emit('ticker', new TickerEvent(
                    this.getName(),
                    data['product_id'],
                    new Ticker(this.getName(), data['product_id'], moment().format('X'), data['best_bid'], data['best_ask'])
                ))
            }

            // order events trigger reload of all open orders
            // "match" is also used in public endpoint, but only our order are holding user information
            if (data.type && data.type.includes('open', 'done', 'match') && data.user_id) {
                /*
                    { type: 'open',
                      side: 'sell',
                      price: '3.93000000',
                      order_id: '7ebcd292-78d5-4ec3-9b81-f58754aba806',
                      remaining_size: '1.00000000',
                      product_id: 'ETC-EUR',
                      sequence: 42219912,
                      user_id: '5a2ae60e76531100d3af2ee5',
                      profile_id: 'e6dd97c2-f4e8-4e9a-b44e-7f6594e330bd',
                      time: '2019-01-20T19:24:33.609000Z'
                    }
                 */

                await this.syncOrders()
            }

            // "match" order = filled: reload balances for our positions
            // "match" is also used in public endpoint, but only our order are holding user information
            if (data.type && data.type === 'match' && data.user_id) {
                await this.syncBalances()
            }

            // we ignore "last_match". its not in our range
            if (data.type && ['match'].includes(data.type)) {
                let resamples = []

                let symbolCfg = symbols.find(symbol => symbol.symbol === data.product_id)
                if (symbolCfg) {
                    resamples = symbolCfg['periods']
                }

                me.onTrade(data, '1m', resamples)
            }
        })

        websocket.on('error', err => {
            this.logger.error('Coinbase Pro: Error ' + String(err))
        })

        websocket.on('close', () => {
            this.logger.info('Coinbase Pro: Connected')
        })
    }

    /**
     * Coinbase does not deliver candles via websocket, so we fake them on the public order history (websocket)
     *
     * @param msg array
     * @param period string
     * @param resamples array
     */
    onTrade(msg, period, resamples = []) {
        if (!msg.price || !msg.size || !msg.product_id) {
            return;
        }

        // Price and volume are sent as strings by the API
        msg.price = parseFloat(msg.price)
        msg.size = parseFloat(msg.size)

        let productId = msg.product_id

        // Round the time to the nearest minute, Change as per your resolution
        let periodMinutes = Resample.convertPeriodToMinute(period)
        let roundedTime = Math.floor(new Date(msg.time) / 60000.0) * (periodMinutes * 60)

        // If the candles hashmap doesnt have this product id create an empty object for that id
        if (!this.candles[productId]) {
            this.candles[productId] = {}
        }

        // candle still open just modify it
        if (this.candles[productId][roundedTime]) {
            // If this timestamp exists in our map for the product id, we need to update an existing candle
            let candle = this.candles[productId][roundedTime]

            candle.high = msg.price > candle.high ? msg.price : candle.high
            candle.low = msg.price < candle.low ? msg.price : candle.low
            candle.close = msg.price
            candle.baseVolume = parseFloat((candle.baseVolume + msg.size).toFixed(8))

            // Set the last candle as the one we just updated
            this.lastCandleMap[productId] = candle

            return
        }

        //Before creating a new candle, lets mark the old one as closed
        let lastCandle = this.lastCandleMap[productId]

        if (lastCandle) {
            lastCandle.closed = true;
            delete this.candles[productId][lastCandle.timestamp]
        }

        // Set Quote Volume to -1 as GDAX doesnt supply it
        this.candles[productId][roundedTime] = {
            timestamp: roundedTime,
            open: msg.price,
            high: msg.price,
            low: msg.price,
            close: msg.price,
            baseVolume: msg.size,
            quoteVolume: -1,
            closed: false
        }

        let ourCandles = []
        for (let timestamp in this.candles[productId]) {
            let candle = this.candles[productId][timestamp]

            ourCandles.push(new Candlestick(
                candle.timestamp,
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.baseVolume,
            ))
        }

        this.eventEmitter.emit('candlestick', new CandlestickEvent('coinbase_pro', msg.product_id, period, ourCandles))

        // wait for insert
        setTimeout(async () => {
            // resample
            await Promise.all(resamples.filter(r => r !== periodMinutes).map(async resamplePeriod => {
                await this.candlestickResample.resample(this.getName(), msg.product_id, period, resamplePeriod, true)
            }))
        }, 1000);

        // delete old candles
        Object.keys(this.candles[productId]).sort((a, b) => b - a).slice(200).forEach(i => {
            delete this.candles[productId][i]
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

    async syncBalances() {
        let accounts = await this.client.getAccounts()
        if (!accounts) {
            return
        }

        let capitals = {}
        this.symbols.filter(s => s.trade && s.trade.capital && s.trade.capital > 0).forEach(s => {
            capitals[s.symbol] = s.trade.capital
        })

        this.logger.debug('Coinbase Pro: Sync balances: ' + Object.keys(capitals).length)

        let positions = [];

        let balances = accounts.filter(b => parseFloat(b.balance) > 0)
        for (let balance of balances) {
            let asset = balance.currency

            for (let pair in capitals) {
                if (pair.startsWith(asset)) {
                    let capital = capitals[pair];
                    let balanceUsed = parseFloat(balance.balance)

                    // 1% balance left indicate open position
                    if (Math.abs(balanceUsed / capital) > 0.1) {
                        positions.push(new Position(pair, 'long', balanceUsed, undefined, new Date(), undefined, new Date()))
                    }
                }
            }
        }

        this.positions = positions
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
            return
        }

        this.orders[order.id] = order
    }

    order(order) {
        return new Promise(async (resolve, reject) => {
            let payload = CoinbasePro.createOrderBody(order)
            let result = undefined

            try {
                result = await this.client.placeOrder(payload)
            } catch (e) {
                this.logger.error("Coinbase Pro: order create error:" + e.message)
                reject()
                return
            }

            let exchangeOrder = CoinbasePro.createOrders(result)[0]

            this.triggerOrder(exchangeOrder)
            resolve(exchangeOrder)
        })
    }

    async cancelOrder(id) {
        let orderId

        try {
            orderId = await this.client.cancelOrder(id)
        } catch (e) {
            this.logger.error('Coinbase Pro: cancel order error: ' + e)
            return
        }

        delete this.orders[orderId]
    }

    async cancelAll(symbol) {
        let orderIds
        try {
            orderIds = await this.client.cancelAllOrders({product_id: symbol})
        } catch (e) {
            this.logger.error('Coinbase Pro: cancel all order error: ' + String(e))
            return
        }

        for (let id of orderIds) {
            delete this.orders[id]
        }
    }

    static createOrderBody(order) {
        if (!order.amount && !order.price && !order.symbol) {
            throw 'Invalid amount for update'
        }

        const myOrder = {
            side: order.price < 0 ? 'sell' : 'buy',
            price: Math.abs(order.price),
            size: Math.abs(order.amount),
            product_id: order.symbol,
        }

        let orderType = undefined
        if (!order.type || order.type === 'limit') {
            orderType = 'limit'
        } else if(order.type === 'stop') {
            orderType = 'stop'
        } else if(order.type === 'market') {
            orderType = 'market'
        }

        if (!orderType) {
            throw 'Invalid order type'
        }

        if (order.options && order.options.post_only === true) {
            myOrder['post_only'] = true
        }

        myOrder['type'] = orderType

        if (order.id) {
            // format issue
            // myOrder['client_oid'] = order.id
        }

        return myOrder
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

    async updateOrder(id, order) {
        if (!order.amount && !order.price) {
            throw 'Invalid amount / price for update'
        }

        let currentOrder = await this.findOrderById(id);
        if (!currentOrder) {
            return
        }

        // cancel order; mostly it can already be canceled
        await this.cancelOrder(id)

        return await this.order(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount))
    }

    async syncPairInfo() {
        let pairs
        try {
            pairs = await this.client.getProducts()
        } catch (e) {
            this.logger.error('Coinbase Pro: pair sync error: ' + e)

            return
        }

        let exchangePairs = {}
        pairs.forEach(pair => {
            exchangePairs[pair['id']] = {
                'tick_size': parseFloat(pair['quote_increment']),
                'lot_size': parseFloat(pair['quote_increment']),
            }
        })

        this.logger.info('Coinbase Pro: pairs synced: ' + pairs.length)
        this.exchangePairs = exchangePairs
    }

    getName() {
        return 'coinbase_pro'
    }
}
