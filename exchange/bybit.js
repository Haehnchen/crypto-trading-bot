'use strict';

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let Orderbook = require('./../dict/orderbook')
let ExchangeCandlestick = require('../dict/exchange_candlestick')
const WebSocket = require('ws');

let resample = require('./../utils/resample')

let moment = require('moment')
let request = require('request');
let crypto = require('crypto')

let Position = require('../dict/position');
let ExchangeOrder = require('../dict/exchange_order');

let orderUtil = require('../utils/order_util')
let _ = require('lodash')

module.exports = class Bybit {
    constructor(eventEmitter, requestClient, candlestickResample, logger, queue, candleImporter) {
        this.eventEmitter = eventEmitter
        this.logger = logger
        this.queue = queue
        this.candleImporter = candleImporter

        this.apiKey = undefined
        this.apiSecret = undefined
        this.tickSizes = {}
        this.lotSizes = {}

        this.positions = {}
        this.orders = {}
        this.tickers = {}
        this.symbols = []
    }

    start(config, symbols) {
        let eventEmitter = this.eventEmitter
        let logger = this.logger
        let tickSizes = this.tickSizes
        let lotSizes = this.lotSizes

        this.symbols = symbols
        this.positions = {}
        this.orders = {}
        this.leverageUpdated = {}

        let ws = new WebSocket('wss://stream.bybit.com/realtime')

        let me = this
        ws.onopen = function() {
            me.logger.info('Bybit: Connection opened.')

            symbols.forEach(symbol => {
                let value = {'op': 'subscribe', 'args': ['kline.BTCUSD.' + symbol['periods'].join('|')]};
                let data = JSON.stringify(value);
                ws.send(data);
            })

            if (config['key'] && config['secret'] && config['key'].length > 0 && config['secret'].length > 0) {
                me.logger.info('Bybit: sending auth request')

                let expires = new Date().getTime() + 10000;
                let signature = crypto.createHmac('sha256', config['secret']).update('GET/realtime' + expires).digest('hex');

                ws.send(JSON.stringify({'op': 'auth', 'args': [config['key'], expires, signature]}));
            } else {
                me.logger.info('Bybit: Starting as anonymous; no trading possible')
            }
        };

        ws.onmessage = async function (event) {
            if (event.type === 'message') {
                let data = JSON.parse(event.data);

                if ('success' in data && data.success === false) {
                    me.logger.error('Bybit: error ' + event.data)
                    console.log('Bybit: error ' + event.data)
                } else if ('success' in data && data.success === true) {
                    if (data.request && data.request.op === 'auth') {
                        me.logger.info('Bybit: Auth successful')

                        ws.send(JSON.stringify({'op': 'subscribe', 'args': ['order']}))
                        ws.send(JSON.stringify({'op': 'subscribe', 'args': ['position']}))
                    }
                } else if (data.topic && data.topic.startsWith('kline.')) {
                    let candle = data.data

                    let candleStick = new ExchangeCandlestick(
                        me.getName(),
                        candle['symbol'],
                        candle['interval'],
                        candle['open_time'],
                        candle['open'],
                        candle['high'],
                        candle['low'],
                        candle['close'],
                        candle['volume'],
                    )

                    await me.candleImporter.insertThrottledCandles([candleStick])
                }
            }
        };

        ws.onclose = function() {
            logger.info('Bybit: Connection closed.')
            console.log('Bybit: Connection closed.')

            // retry connecting after some second to not bothering on high load
            setTimeout(() => {
                me.start(config, symbols)
            }, 10000);
        };

        symbols.forEach(symbol => {
            symbol['periods'].forEach(period => {
                // for bot init prefill data: load latest candles from api
                this.queue.add(() => {
                    let minutes = resample.convertPeriodToMinute(period)

                    // from is required calculate to be inside window
                    let from = Math.floor((new Date()).getTime() / 1000) - (minutes * 195 * 60)

                    let s = me.getBaseUrl() + '/v2/public/kline/list?symbol=' + symbol['symbol'] + '&from=' + from + '' + '&interval=' + minutes;
                    request(s, { json: true }, async (err, res, body) => {
                        if (err) {
                            console.log('Bybit: Candle backfill error: ' + String(err))
                            logger.error('Bybit: Candle backfill error: ' + String(err))
                            return
                        }

                        if (!body || !body.result || !Array.isArray(body.result)) {
                            console.log('Bybit: Candle backfill error: ' + JSON.stringify(body));
                            logger.error('Bybit Candle backfill error: ' + JSON.stringify(body))
                            return
                        }

                        let candleSticks = body.result.map(candle => {
                            return new ExchangeCandlestick(
                                me.getName(),
                                candle['symbol'],
                                period,
                                candle['open_time'],
                                candle['open'],
                                candle['high'],
                                candle['low'],
                                candle['close'],
                                candle['volume'],
                            )
                        })

                        await this.candleImporter.insertThrottledCandles(candleSticks.map(candle => {
                            return ExchangeCandlestick.createFromCandle(this.getName(), symbol['symbol'], period, candle)
                        }))
                    })
                })
            })
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
            if (position['symbol'] in this.positions && position['isOpen'] !== true) {
                delete this.positions[position.symbol]
                continue
            }

            openPositions.push(position)
        }

        let currentPositions = {}

        for(const position of Bitmex.createPositionsWithOpenStateOnly(openPositions)) {
            currentPositions[position.symbol] = position
        }

        this.positions = currentPositions
    }

    /**
     * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
     *
     * @param orders Orders in raw json from Bitmex
     */
    fullOrdersUpdate(orders) {
        let ourOrders = {}
        for (let order of Bitmex.createOrders(orders).filter(order => order.status === 'open')) {
            ourOrders[order.id] = order
        }

        this.orders = ourOrders
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
                order.id === id || order.id == id
            ))
        })
    }

    getOrdersForSymbol(symbol) {
        return new Promise(async resolve => {
            resolve((await this.getOrders()).filter(order => order.symbol === symbol))
        })
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
        return 'bybit'
    }

    order(order) {
        throw 'Not implemented'
    }

    /**
     * Set the configured leverage size "0-100" for pair before creating an order default "3" if not provided in configuration
     *
     * symbol configuration via:
     *
     * "extra.bitmex_leverage": 5
     *
     * @param symbol
     * @returns {Promise<any>}
     */
    async updateLeverage(symbol) {
        throw 'Not implemented'
    }

    cancelOrder(id) {
        throw 'Not implemented'
    }

    cancelAll(symbol) {
        throw 'Not implemented'
    }

    updateOrder(id, order) {
        throw 'Not implemented'
    }

    /**
     * Convert incoming positions only if they are open
     *
     * @param positions
     * @returns {*}
     */
    static createPositionsWithOpenStateOnly(positions) {
        return positions.filter((position) => {
            return position['isOpen'] === true
        }).map(position => {
            return new Position(
                position['symbol'],
                position['currentQty'] < 0 ? 'short' : 'long',
                position['currentQty'],
                position['unrealisedRoePcnt']  * 100,
                new Date(),
                position['avgEntryPrice'],
                new Date(position['openingTimestamp'])
            )
        })
    }

    static createOrders(orders) {
        throw 'Not implemented'

        return orders.map(order => {
             return new ExchangeOrder()
        })
    }

    getBaseUrl() {
        return 'https://api.bybit.com'
    }
}
