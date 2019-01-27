'use strict';

const BinanceClient = require('binance-api-node').default

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let CandlestickEvent = require('./../event/candlestick_event')
let TickerEvent = require('./../event/ticker_event')
let ExchangeOrder = require('../dict/exchange_order')
let moment = require('moment')
let OrderUtil = require('../utils/order_util')
let Position = require('../dict/position')
let Order = require('../dict/order')

module.exports = class Binance {
    constructor(eventEmitter, logger) {
        this.eventEmitter = eventEmitter
        this.logger = logger
        this.client = undefined
        this.orders = {}
        this.exchangePairs = {}
        this.symbols = {}
        this.positions = []
        this.trades = {}
        this.tickers = {}
    }

    start(config, symbols) {
        this.symbols = symbols

        const eventEmitter = this.eventEmitter
        const logger = this.logger

        let opts = {}

        if (config['key'] && config['secret'] && config['key'].length > 0 && config['secret'].length > 0) {
            opts['apiKey'] = config['key']
            opts['apiSecret'] = config['secret']
        }

        const client = this.client = BinanceClient(opts)

        let me = this

        if (config['key'] && config['secret']) {
            setTimeout(() => {
                me.onWebSocketMessage()
            }, 500);

            setInterval(function f() {
                me.syncBalances()
                return f
            }(), 60 * 60 * 1 * 1000)

            setInterval(function f() {
                me.syncOrders()
                return f
            }(), 1000 * 30)

            // since pairs
            setInterval(function f() {
                me.syncPairInfo()
                return f
            }(), 60 * 60 * 15 * 1000);
        } else {
            this.logger.info('Binace: Starting as anonymous; no trading possible')
        }

        symbols.forEach(symbol => {
            symbol['periods'].forEach(interval => {
                // backfill
                client.candles({'symbol': symbol['symbol'], 'limit': 500, 'interval': interval}).then((candles) => {
                    let ourCandles = candles.map(candle => {
                        return new Candlestick(
                            Math.round(candle['openTime'] / 1000),
                            candle['open'],
                            candle['high'],
                            candle['low'],
                            candle['close'],
                            candle['volume'],
                        )
                    })

                    eventEmitter.emit('candlestick', new CandlestickEvent('binance', symbol['symbol'], interval, ourCandles));
                })


                // live candles
                client.ws.candles(symbol['symbol'], interval, candle => {
                    let ourCandle = new Candlestick(
                        Math.round(candle['startTime'] / 1000),
                        candle['open'],
                        candle['high'],
                        candle['low'],
                        candle['close'],
                        candle['volume'],
                    )

                    eventEmitter.emit('candlestick', new CandlestickEvent('binance', symbol['symbol'], interval, [ourCandle]));
                })

                // live prices
                client.ws.ticker(symbol['symbol'], ticker => {
                    eventEmitter.emit('ticker', new TickerEvent(
                        'binance',
                        symbol['symbol'],
                        this.tickers[symbol['symbol']] = new Ticker('binance', symbol['symbol'], moment().format('X'), ticker['bestBid'], ticker['bestAsk'])
                    ))
                })
            })
        })
    }

    order(order) {
        return new Promise(async (resolve, reject) => {
            let payload = Binance.createOrderBody(order)
            let result = undefined

            try {
                result = await this.client.order(payload)
            } catch (e) {
                this.logger.error("Binance: order create error:" + e.message)
                reject()
                return
            }

            let exchangeOrder = Binance.createOrders(result)[0]

            this.triggerOrder(exchangeOrder)
            resolve(exchangeOrder)
        })
    }

    async cancelOrder(id) {
        let order = await this.findOrderById(id)
        if (!order) {
            return
        }

        try {
            await this.client.cancelOrder({
                symbol: order.symbol,
                orderId: id,
            })
        } catch (e) {
            this.logger.error('Binance: cancel order error: ' + e)
            return
        }

        delete this.orders[id]

        return ExchangeOrder.createCanceled(order)
    }

    async cancelAll(symbol) {
        let orders = []

        for (let order of (await this.getOrdersForSymbol(symbol))) {
            orders.push(await this.cancelOrder(order.id))
        }

        return orders
    }

    static createOrderBody(order) {
        if (!order.amount && !order.price && !order.symbol) {
            throw 'Invalid amount for update'
        }

        let myOrder = {
            symbol: order.symbol,
            side: order.price < 0 ? 'SELL' : 'BUY',
            quantity: Math.abs(order.amount),
        }

        let orderType = undefined
        if (!order.type || order.type === 'limit') {
            orderType = 'LIMIT'
            myOrder.price = Math.abs(order.price)
        } else if(order.type === 'stop') {
            orderType = 'STOP_LOSS'
            myOrder.stopPrice = Math.abs(order.price)
        } else if(order.type === 'market') {
            orderType = 'MARKET'
        }

        if (!orderType) {
            throw 'Invalid order type'
        }

        myOrder['type'] = orderType

        if (order.id) {
            myOrder['newClientOrderId'] = order.id
        }

        return myOrder
    }

    static createOrders(...orders) {
        return orders.map(order => {
            let retry = false

            let status = undefined
            let orderStatus = order['status'].toLowerCase().replace('_', '')

            // https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md#enum-definitions
            if (['new', 'partiallyfilled', 'pendingnew'].includes(orderStatus)) {
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
                case 'stop_loss':
                    orderType = 'stop'
                    break;
            }

            return new ExchangeOrder(
                order['orderId'],
                order['symbol'],
                status,
                parseFloat(order.price),
                parseFloat(order['origQty']),
                retry,
                order['clientOrderId'],
                order['side'].toLowerCase() === 'buy' ? 'buy' : 'sell', // secure the value,
                orderType,
                new Date(order['transactTime']),
                new Date(),
                order
            )
        })
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

    async getPositions() {
        let results = []

        for (let position of this.positions) {
            if (!position.profit && position.entry && this.tickers[position.symbol]) {
                position = Position.createProfitUpdate(position, ((this.tickers[position.symbol].bid / position.entry) - 1) * 100)
            }

            results.push(position)
        }

        return results
    }

    async getPositionForSymbol(symbol) {
        for (let position of (await this.getPositions())) {
            if(position.symbol === symbol) {
                return position
            }
        }

        return undefined
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

    getName() {
        return 'binance'
    }

    async onWebSocketMessage() {
        await this.client.ws.user(async event => {
            if (event.eventType && event.eventType === 'executionReport' && ('orderStatus' in event || 'orderId' in event)) {
                this.logger.debug('Binance: Got executionReport order event: ' + JSON.stringify(event))

                await this.syncBalances()
                await this.syncOrders()
            }
        })
    }

    async syncBalances() {
        let account = await this.client.accountInfo()
        if (!account || !account.balances) {
            return
        }

        await this.syncTradesForEntries()

        let capitals = {}
        this.symbols.filter(s => s.trade && s.trade.capital && s.trade.capital > 0).forEach(s => {
            capitals[s.symbol] = s.trade.capital
        })

        this.logger.debug('Binance: Sync balances: ' + Object.keys(capitals).length)

        let positions = [];

        let balances = account.balances.filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0)
        for (let balance of balances) {
            let asset = balance.asset

            for (let pair in capitals) {
                if (pair.startsWith(asset)) {
                    let capital = capitals[pair];
                    let balanceUsed = parseFloat(balance.free) + parseFloat(balance.locked)

                    // 1% balance left indicate open position
                    if (Math.abs(balanceUsed / capital) > 0.1) {
                        let entry
                        let createdAt = new Date();

                        if (this.trades[pair] && this.trades[pair].side === 'buy') {
                            entry = parseFloat(this.trades[pair].price)
                            createdAt = this.trades[pair].time
                        }

                        positions.push(new Position(pair, 'long', balanceUsed, undefined, new Date(), entry, createdAt))
                    }
                }
            }
        }

        this.positions = positions
    }

    async syncOrders() {
        let symbols = this.symbols.filter(s => s.trade && s.trade.capital && s.trade.capital > 0).map(s => s.symbol)
        this.logger.debug('Binance: Sync orders for symbols: ' + symbols.length)

        let openOrders = await this.client.openOrders(false)
        let myOrders = Binance.createOrders(...openOrders)

        let orders = {}
        myOrders.forEach(o => {
            orders[o.id] = o
        })

        this.orders = orders
    }

    async syncTradesForEntries() {
        let symbols = this.symbols.filter(s => s.trade && s.trade.capital && s.trade.capital > 0).map(s => s.symbol)
        this.logger.debug('Binance: Sync trades for entries: ' + symbols.length)

        let promises = []

        for (let symbol of symbols) {
            promises.push(new Promise(async resolve => {
                let symbolOrders

                try {
                    symbolOrders = (await this.client.allOrders({symbol: symbol, limit: 150}));
                } catch (e) {
                    this.logger.error('Binance: ' + String(e))
                    return resolve(undefined)
                }

                let orders = symbolOrders.filter(
                    order => order.status.toLowerCase() === 'filled'
                ).sort(
                    (a, b) => b.time - a.time
                ).map(
                    order => {
                        return {
                            'side': order.side.toLowerCase(),
                            'price': order.price,
                            'symbol': order.symbol,
                            'time': new Date(order.time)
                        }
                    }
                )

                return resolve(orders.length > 0 ? orders[0] : undefined)
            }))
        }

        let trades = {}
        let items = await Promise.all(promises);
        items.forEach(o => {
            if (o) {
                trades[o.symbol] = o
            }
        })

        this.trades = trades
    }

    async syncPairInfo() {
        let pairs = await this.client.exchangeInfo()
        if (!pairs.symbols) {
            return
        }

        let exchangePairs = {}
        pairs.symbols.forEach(pair => {
            let pairInfo = {}

            let priceFilter = pair.filters.find(f => f.filterType === 'PRICE_FILTER')
            if (priceFilter) {
                pairInfo['tick_size'] = parseFloat(priceFilter.tickSize)
            }

            let lotSize = pair.filters.find(f => f.filterType === 'LOT_SIZE')
            if (priceFilter) {
                pairInfo['lot_size'] = parseFloat(lotSize.stepSize)
            }

            exchangePairs[pair['symbol']] = pairInfo
        })

        this.logger.info('Binance: pairs synced: ' + pairs.symbols.length)
        this.exchangePairs = exchangePairs
    }
}
