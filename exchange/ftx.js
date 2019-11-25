'use strict';

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let TickerEvent = require('./../event/ticker_event')
let Orderbook = require('./../dict/orderbook')
let Order = require('./../dict/order')
let ExchangeCandlestick = require('../dict/exchange_candlestick')
const WebSocket = require('ws');
const querystring = require('querystring');
const ccxt = require ('ccxt')

let resample = require('./../utils/resample')

let moment = require('moment')
let request = require('request');
let crypto = require('crypto')

let Position = require('../dict/position');
let ExchangeOrder = require('../dict/exchange_order');

let orderUtil = require('../utils/order_util')
let CcxtUtil = require('./utils/ccxt_util')
let CcxtExchangeOrder = require('./ccxt/ccxt_exchange_order')
let _ = require('lodash')

module.exports = class Ftx {
    constructor(eventEmitter, requestClient, candlestickResample, logger, queue, candleImporter) {
        this.eventEmitter = eventEmitter
        this.logger = logger
        this.queue = queue
        this.candleImporter = candleImporter
        this.requestClient = requestClient
        this.exchange = null

        this.apiKey = undefined
        this.apiSecret = undefined
        this.ccxtExchangeOrder = undefined
        this.tickSizes = {}
        this.lotSizes = {}

        this.positions = {}
        this.orders = {}
        this.tickers = {}
        this.symbols = []
        this.intervals = []
    }

    start(config, symbols) {
        let eventEmitter = this.eventEmitter
        let logger = this.logger
        let tickSizes = this.tickSizes
        let lotSizes = this.lotSizes
        this.exchange = null

        const ccxtClient = new ccxt.ftx({
            'apiKey': config['key'],
            'secret': config['secret'],
        })

        this.ccxtExchangeOrder = new CcxtExchangeOrder(ccxtClient, this.symbols, this.logger);

        this.intervals = []

        this.symbols = symbols
        this.positions = {}
        this.orders = {}
        this.leverageUpdated = {}

        let ws = new WebSocket('wss://ftx.com/ws/')

        let me = this
        ws.onopen = function() {
            me.logger.info('FTX: Connection opened.')

            symbols.forEach(symbol => {
                //ws.send(JSON.stringify({'op': 'subscribe', 'channel': 'trades', 'market': symbol.symbol}));
                ws.send(JSON.stringify({'op': 'subscribe', 'channel': 'ticker', 'market': symbol.symbol}));
            })

            if (config['key'] && config['secret'] && config['key'].length > 0 && config['secret'].length > 0) {
                let time = new Date().getTime();
                let signature = crypto.createHmac('sha256', config['secret']).update(time + 'websocket_login').digest('hex');

                ws.send(JSON.stringify({'op': 'login', 'args': {'key': config['key'], 'sign': signature, 'time': time}}));

                me.exchange = new ccxt.ftx({
                    apiKey: config['key'],
                    secret: config['secret'],
                })

                setInterval(function f() {
                    me.ccxtExchangeOrder.syncOrders()
                    me.syncPositionViaRestApi()
                    return f
                }(), 1000 * 30)

                setTimeout(() => {
                    ws.send(JSON.stringify({'op': 'subscribe', 'channel': 'fills'}));
                    ws.send(JSON.stringify({'op': 'subscribe', 'channel': 'orders'}));
                }, 5000);
            } else {
                me.logger.info('FTX: Starting as anonymous; no trading possible')
            }
        };

        ws.onmessage = async function (event) {
            if (event.type === 'message') {
                let data = JSON.parse(event.data);

                if (data.type === 'subscribed') {
                    logger.debug('FTX: subscribed to channel: ' + data.channel)
                    return
                } else if (data.type === 'error') {
                    logger.error('FTX: websocket error: ' + JSON.stringify(data))
                    return
                }

                if (data.channel === 'orders') {
                    me.ccxtExchangeOrder.triggerOrder(ccxtClient.parseOrder(data.data))
                }

                if (data.channel === 'ticker') {
                    eventEmitter.emit('ticker', new TickerEvent(
                        me.getName(),
                        data.market,
                        new Ticker(me.getName(), data.market, moment().format('X'), data.data.bid, data.data.ask)
                    ))
                }
            }
        };

        ws.onclose = function() {
            logger.info('FTX: Connection closed.')
            console.log('FTX: Connection closed.')

            for (let interval of me.intervals) {
                clearInterval(interval)
            }

            me.intervals = [];

            // retry connecting after some second to not bothering on high load
            setTimeout(() => {
                me.start(config, symbols)
            }, 10000);
        };

        symbols.forEach(symbol => {
            symbol['periods'].forEach(period => {
                // for bot init prefill data: load latest candles from api
                this.queue.add(() => {
                })
            })
        })
    }

    async syncOrders() {
        this.logger.debug('FTX: sync orders')
        const orders = await this.exchange.fetchOpenOrders()

        CcxtUtil.createExchangeOrder(orders).forEach(order => {
            this.triggerOrder(order)
        })
    }

    /**
     * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
     *
     * @param positions Position in raw json from Bitmex
     */
    fullPositionsUpdate(positions) {
        let openPositions = []

        for (const position of positions) {
            if (position['symbol'] in this.positions && !['buy', 'sell'].includes(position['side'].toLowerCase())) {
                delete this.positions[position.symbol]
                continue
            }

            openPositions.push(position)
        }

        let currentPositions = {}

        for(const position of Bybit.createPositionsWithOpenStateOnly(openPositions)) {
            currentPositions[position.symbol] = position
        }

        this.positions = currentPositions
    }

    async getOrders() {
        return this.ccxtExchangeOrder.getOrders()
    }

    async findOrderById(id) {
        return this.ccxtExchangeOrder.findOrderById(id)
    }

    async getOrdersForSymbol(symbol) {
        return this.ccxtExchangeOrder.getOrdersForSymbol(symbol)
    }

    async getPositions() {
        let results = []

        for (let x in this.positions) {
            let position = this.positions[x]
            if (position.entry && this.tickers[position.symbol]) {
                if (position.side === 'long') {
                    position = Position.createProfitUpdate(position, ((this.tickers[position.symbol].bid / position.entry) - 1) * 100)
                } else if (position.side === 'short') {
                    position = Position.createProfitUpdate(position, ((position.entry / this.tickers[position.symbol].ask ) - 1) * 100)
                }
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

    /**
     * LTC: 0.008195 => 0.00820
     *
     * @param price
     * @param symbol
     * @returns {*}
     */
    calculatePrice(price, symbol) {
        if (!(symbol in this.tickSizes)) {
            return undefined
        }

        return orderUtil.calculateNearestSize(price, this.tickSizes[symbol])
    }

    /**
     * Force an order update only if order is "not closed" for any reason already by exchange
     *
     * @param order
     */
    async triggerOrder(order) {
        if (!(order instanceof ExchangeOrder)) {
            throw 'Invalid order given'
        }

        await this.ccxtExchangeOrder.triggerOrder(order)
    }

    /**
     * LTC: 0.65 => 1
     *
     * @param amount
     * @param symbol
     * @returns {*}
     */
    calculateAmount(amount, symbol) {
        if (!(symbol in this.lotSizes)) {
            return undefined
        }

        return orderUtil.calculateNearestSize(amount, this.lotSizes[symbol])
    }

    getName() {
        return 'ftx'
    }

    async order(order) {
        return this.ccxtExchangeOrder.createOrder(order)
    }

    /**
     * Set the configured leverage size "0-100" for pair before creating an order default "5" if not provided in configuration
     *
     * symbol configuration via:
     *
     * "extra.bybit_leverage": 5
     *
     * @param symbol
     */
    async updateLeverage(symbol) {
    }

    async cancelOrder(id) {
        return this.ccxtExchangeOrder.cancelOrder(id)
    }

    async cancelAll(symbol) {
        return this.ccxtExchangeOrder.cancelAll(symbol)
    }

    async updateOrder(id, order) {
        if (!order.amount && !order.price) {
            throw 'Invalid amount / price for update'
        }

        return this.ccxtExchangeOrder.updateOrder(id, order)
    }

    /**
     * Convert incoming positions only if they are open
     *
     * @param positions
     * @returns {*}
     */
    static createPositionsWithOpenStateOnly(positions) {
        return positions.filter((position) => {
            return ['buy', 'sell'].includes(position['side'].toLowerCase())
        }).map(position => {
            let side = position['side'].toLowerCase() === 'buy' ? 'long' : 'short';
            let size = position['size'];

            if (side === 'short') {
                size = size * -1
            }

            return new Position(
                position['symbol'],
                side,
                size,
                position['unrealised_pnl'] && position['position_value'] ? parseFloat((position['unrealised_pnl'] / position['position_value'] * 100).toFixed(2)) : null,
                new Date(),
                parseFloat(position['entry_price']),
                new Date(),
            )
        })
    }

    /**
     * As a websocket fallback update orders also on REST
     */
    async syncPositionViaRestApi() {
        //let positions = await this.exchange.privateGetPositions()

        //let pos = CcxtUtil.createPositions(positions);

        //console.log(pos)


        //this.fullPositionsUpdate(json.result)
    }
}
