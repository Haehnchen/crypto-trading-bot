'use strict';

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let TickerEvent = require('./../event/ticker_event')
let Orderbook = require('./../dict/orderbook')
let ExchangeCandlestick = require('../dict/exchange_candlestick')
const WebSocket = require('ws');
const querystring = require('querystring');

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
        this.requestClient = requestClient

        this.apiKey = undefined
        this.apiSecret = undefined
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
        this.intervals = []

        this.symbols = symbols
        this.positions = {}
        this.orders = {}
        this.leverageUpdated = {}

        this.requestClient.executeRequestRetry({
            url: this.getBaseUrl() + '/v2/public/symbols',
        }, result => {
            return result && result.response && result.response.statusCode >= 500
        }).then(response => {
            let body = JSON.parse(response.body)
            if (!body.result) {
                this.logger.error('Bybit: invalid instruments request: ' + response.body)
                return
            }

            body.result.forEach(instrument => {
                tickSizes[instrument['name']] = instrument['price_filter']['tick_size']
                lotSizes[instrument['name']] = instrument['lot_size_filter']['qty_step']
            })
        })

        let ws = new WebSocket('wss://stream.bybit.com/realtime')

        let me = this
        ws.onopen = function() {
            me.logger.info('Bybit: Connection opened.')

            symbols.forEach(symbol => {
                let value = {'op': 'subscribe', 'args': ['kline.' + symbol['symbol'] +'.' + symbol['periods'].join('|')]};
                let data = JSON.stringify(value);
                //ws.send(data);

                ws.send(JSON.stringify({'op': 'subscribe', 'args': ['instrument.' + symbol['symbol']]}));
            })

            if (config['key'] && config['secret'] && config['key'].length > 0 && config['secret'].length > 0) {
                me.logger.info('Bybit: sending auth request')
                me.apiKey = config['key'];
                me.apiSecret = config['secret'];

                let expires = new Date().getTime() + 10000;
                let signature = crypto.createHmac('sha256', config['secret']).update('GET/realtime' + expires).digest('hex');

                ws.send(JSON.stringify({'op': 'auth', 'args': [config['key'], expires, signature]}));

                // load full order and positions in intervals; in case websocket is out opf sync
                setTimeout(() => {
                    me.intervals.push(setInterval(function f() {
                        me.syncOrdersViaRestApi(symbols.map(symbol => symbol['symbol']));
                        me.syncPositionViaRestApi()
                        return f
                    }(), 60000));
                }, 5000);
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
                        ws.send(JSON.stringify({'op': 'subscribe', 'args': ['execution']}))
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
                } else if (data.data && data.topic && data.topic.startsWith('instrument.')) {
                    data.data.forEach(instrument => {
                        // not always given
                        if (!instrument['last_price']) {
                            return
                        }

                        eventEmitter.emit('ticker', new TickerEvent(
                            me.getName(),
                            instrument['symbol'],
                            me.tickers[instrument['symbol']] = new Ticker(me.getName(), instrument['symbol'], moment().format('X'), instrument['last_price'], instrument['last_price'])
                        ))
                    })
                } else if (data.data && data.topic && data.topic.toLowerCase() === 'order') {
                    let orders = data.data;

                    Bybit.createOrders(orders).forEach(order => {
                        me.triggerOrder(order)
                    })
                } else if (data.data && data.topic && data.topic.toLowerCase() === 'position') {
                    let positionsRaw = data.data;
                    let positions = []

                    positionsRaw.forEach(positionRaw => {
                        if (!['buy', 'sell'].includes(positionRaw['side'].toLowerCase())) {
                            delete me.positions[positionRaw.symbol]
                        } else {
                            positions.push(positionRaw)
                        }
                    })

                    Bybit.createPositionsWithOpenStateOnly(positions).forEach(position => {
                        me.positions[position.symbol] = position
                    })
                }
            }
        };

        ws.onclose = function() {
            logger.info('Bybit: Connection closed.')
            console.log('Bybit: Connection closed.')

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

    /**
     * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
     *
     * @param orders Orders in raw json from Bitmex
     */
    fullOrdersUpdate(orders) {
        let ourOrders = {}
        for (let order of Bybit.createOrders(orders).filter(order => order.status === 'open')) {
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
            delete this.orders[order.id]
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

    async order(order) {
        let parameters = Bybit.createOrderBody(order)

        parameters['api_key'] = this.apiKey
        parameters['timestamp'] = new Date().getTime()

        if (order.type === 'stop') {
            if (!this.tickers[order.symbol]) {
                this.logger.error('Bybit: base_price based on ticker for conditional not found')
                return
            }

            parameters['base_price'] = this.tickers[order.symbol].bid
        }

        let parametersSorted = {}
        Object.keys(parameters).sort().forEach(key => parametersSorted[key] = parameters[key])

        parametersSorted['sign'] = crypto.createHmac('sha256', this.apiSecret)
            .update(querystring.stringify(parametersSorted))
            .digest('hex');

        let url
        if (order.type === 'stop') {
            url = this.getBaseUrl() + '/open-api/stop-order/create?' + querystring.stringify(parametersSorted);
        } else {
            url = this.getBaseUrl() + '/open-api/order/create?' + querystring.stringify(parametersSorted);
        }

        await this.updateLeverage(order.symbol)

        let result = await this.requestClient.executeRequestRetry({
            method: 'POST',
            url: url,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        }, result => {
            return result && result.response && result.response.statusCode >= 500
        })

        let error = result.error
        let response = result.response
        let body = result.body

        if (error || !response || response.statusCode !== 200) {
            this.logger.error('Bybit: Invalid order create:' + JSON.stringify({'error': error, 'body': body}))
            return
        }

        let json = JSON.parse(body);
        if (!json.result) {
            this.logger.error('Bybit: Invalid order create body:' + JSON.stringify({'body': body}))
            return
        }

        let returnOrder
        Bybit.createOrders([json.result]).forEach(order => {
            this.triggerOrder(order)
            returnOrder = order
        })

        return returnOrder
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
        let config = this.symbols.find(cSymbol => cSymbol.symbol === symbol)
        if (!config) {
            this.logger.error('Bybit: Invalid leverage config for:' + symbol)
            return
        }

        // use default leverage to "3"
        let leverageSize = _.get(config, 'extra.bybit_leverage', 5)
        if (leverageSize < 0 || leverageSize > 100) {
            throw 'Invalid leverage size for: ' + leverageSize + ' ' + symbol
        }

        // we dont get the selected leverage value in websocket or api endpoints
        // so we update them only in a given time window; system overload is often blocked
        if (symbol in this.leverageUpdated && this.leverageUpdated[symbol] > moment().subtract(45, 'minutes')) {
            this.logger.debug('Bybit: leverage update not needed: ' + symbol)
            return
        }

        let parameters = {
            'api_key': this.apiKey,
            'leverage': leverageSize,
            'symbol': symbol,
            'timestamp': new Date().getTime(),
        }

        parameters['sign'] = crypto.createHmac('sha256', this.apiSecret)
            .update(querystring.stringify(parameters))
            .digest('hex');

        let result = await this.requestClient.executeRequestRetry({
            method: 'POST',
            url: this.getBaseUrl() + '/user/leverage/save?' + querystring.stringify(parameters),
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        }, result => {
            return result && result.response && result.response.statusCode >= 500
        })

        let error = result.error
        let response = result.response
        let body = result.body

        if (error || !response || response.statusCode !== 200) {
            this.logger.error('Bybit: Invalid leverage update request:' + JSON.stringify({'error': error, 'body': body}))
            return
        }

        let json = JSON.parse(body)
        if (json['ret_msg'] === 'ok' || json['ret_code'] === 0) {
            this.logger.debug('Bybit: Leverage update:' + JSON.stringify(symbol))
            // set updated indicator; for not update on next request
            this.leverageUpdated[symbol] = new Date()
            return
        }

        this.logger.error('Bybit: Leverage update error invalid body:' + body)
    }

    async cancelOrder(id) {
        let order = await this.findOrderById(id)
        if (!order) {
            return
        }

        let parameters = {
            'api_key': this.apiKey,
            [order.type === 'stop' ? 'stop_order_id' : 'order_id']: id,
            'timestamp': new Date().getTime(),
        }

        parameters['sign'] = crypto.createHmac('sha256', this.apiSecret)
            .update(querystring.stringify(parameters))
            .digest('hex');

        let url
        if (order.type === 'stop') {
            url = this.getBaseUrl() + '/open-api/stop-order/cancel?' + querystring.stringify(parameters);
        } else {
            url = this.getBaseUrl() + '/open-api/order/cancel?' + querystring.stringify(parameters);
        }

        let result = await this.requestClient.executeRequestRetry({
            method: 'post',
            url: url,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            }
        }, result => {
            return result && result.response && result.response.statusCode >= 500
        })

        let error = result.error
        let response = result.response
        let body = result.body

        if (error || !response || response.statusCode !== 200) {
            this.logger.error('Bybit: Invalid order cancel:' + JSON.stringify({'error': error, 'body': body}))
            return
        }

        let json = JSON.parse(body);
        if (!json.result) {
            this.logger.error('Bybit: Invalid order cancel body:' + JSON.stringify({'body': body}))
            return
        }

        let returnOrder
        Bybit.createOrders([json.result]).forEach(order => {
            this.triggerOrder(order)
            returnOrder = order
        })

        return returnOrder
    }

    async cancelAll(symbol) {
        let orders = []

        for (let order of (await this.getOrdersForSymbol(symbol))) {
            orders.push(await this.cancelOrder(order.id))
        }

        return orders
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
                undefined,
                new Date(),
                parseFloat(position['entry_price']),
                new Date(),
            )
        })
    }

    static createOrders(orders) {
        return orders.map(order => {
            let retry = false

            let status = undefined

            let orderStatus
            let orderType = undefined

            if (order['order_status']) {
                orderStatus = order['order_status'].toLowerCase()
            } else if (order['stop_order_status'] && order['stop_order_status'].toLowerCase() === 'untriggered') {
                orderStatus = 'new'
                orderType = 'stop'
            }

            if (['new', 'partiallyfilled', 'pendingnew', 'doneforday', 'stopped'].includes(orderStatus)) {
                status = 'open'
            } else if (orderStatus === 'filled') {
                status = 'done'
            } else if (orderStatus === 'canceled') {
                status = 'canceled'
            } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
                status = 'rejected'
                retry = true
            }

            let ordType = order['order_type'].toLowerCase();

            // secure the value
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
                price = order['stop_px']
            }

            let options = {}
            if (order.ext_fields && order.ext_fields.reduce_only === true) {
                options['reduce_only']= true
            }

            let createdAt;
            if (order['timestamp']) {
                createdAt = new Date(order['timestamp'])
            } else if (order['created_at']) {
                createdAt = new Date(order['created_at'])
            }

            let orderId;
            if (order['order_id']) {
                orderId = order['order_id'];
            } else if (order['stop_order_id']) {
                orderId = order['stop_order_id'];
            }

            return new ExchangeOrder(
                orderId,
                order['symbol'],
                status,
                price,
                order['qty'],
                retry,
                order['order_link_id'],
                order['side'].toLowerCase() === 'sell' ? 'sell' : 'buy', // secure the value,
                orderType,
                createdAt,
                new Date(),
                JSON.parse(JSON.stringify(order)),
                options
            )
        })
    }

    /**
     * As a websocket fallback update positions also on REST
     */
    async syncOrdersViaRestApi(symbols) {
        let promises = [];

        symbols.forEach(symbol => {
            // there is not full active order state; we need some more queries
            ['Created', 'New', 'PartiallyFilled'].forEach(orderStatus => {
                promises.push(new Promise(async resolve => {
                    let parameter = {
                        'api_key': this.apiKey,
                        'limit': 100,
                        'order_status': orderStatus,
                        'symbol': symbol,
                        'timestamp': new Date().getTime(), // 1 min in the future
                    }

                    parameter['sign'] = crypto.createHmac('sha256', this.apiSecret)
                        .update(querystring.stringify(parameter))
                        .digest('hex');

                    let url = this.getBaseUrl() + '/open-api/order/list?' + querystring.stringify(parameter);
                    let result = await this.requestClient.executeRequestRetry({
                        url: url,
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json',
                        }
                    }, result => {
                        return result && result.response && result.response.statusCode >= 500
                    })

                    let error = result.error
                    let response = result.response
                    let body = result.body

                    if (error || !response || response.statusCode !== 200) {
                        this.logger.error('Bybit: Invalid order update:' + JSON.stringify({'error': error, 'body': body}))
                        resolve()
                        return
                    }

                    let json = JSON.parse(body);
                    let orders = json.result.data;
                    resolve(orders)
                }))
            })

            // stop order are special endpoint
            promises.push(new Promise(async resolve => {
                let parameter = {
                    'api_key': this.apiKey,
                    'limit': 100,
                    'symbol': symbol,
                    'timestamp': new Date().getTime(),
                }

                parameter['sign'] = crypto.createHmac('sha256', this.apiSecret)
                    .update(querystring.stringify(parameter))
                    .digest('hex');

                let url = this.getBaseUrl() + '/open-api/stop-order/list?' + querystring.stringify(parameter);
                let result = await this.requestClient.executeRequestRetry({
                    url: url,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                    }
                }, result => {
                    return result && result.response && result.response.statusCode >= 500
                })

                let error = result.error
                let response = result.response
                let body = result.body

                if (error || !response || response.statusCode !== 200) {
                    this.logger.error('Bybit: Invalid order update:' + JSON.stringify({'error': error, 'body': body}))
                    resolve()
                    return
                }

                let json = JSON.parse(body);
                let orders = json.result.data.filter(order => order.stop_order_status === 'Untriggered');
                resolve(orders)
            }))
        })

        let results = await Promise.all(promises)

        let orders = []
        results.forEach(order => {
            orders.push(...order)
        })

        this.fullOrdersUpdate(orders)
    }

    /**
     * As a websocket fallback update orders also on REST
     */
    async syncPositionViaRestApi() {
        let parameter = {
            'api_key': this.apiKey,
            'timestamp': new Date().getTime(), // 1 min in the future
        }

        parameter['sign'] = crypto.createHmac('sha256', this.apiSecret)
            .update(querystring.stringify(parameter))
            .digest('hex');

        let url = this.getBaseUrl() + '/position/list?' + querystring.stringify(parameter);
        let result = await this.requestClient.executeRequestRetry({
            url: url,
            headers: {
                'Content-Type' : 'application/json',
                'Accept': 'application/json',
            }
        }, result => {
            return result && result.response && result.response.statusCode >= 500
        })

        let error = result.error
        let response = result.response
        let body = result.body

        if (error || !response || response.statusCode !== 200) {
            this.logger.error('Bybit: Invalid position update:' + JSON.stringify({'error': error, 'body': body}))
            return
        }

        this.logger.debug('Bybit: Positions via API updated')
        let json = JSON.parse(body);
        this.fullPositionsUpdate(json.result)
    }

    /**
     * Create a REST API body for Bitmex based on our internal order
     *
     * @param order
     * @returns {{symbol: *, orderQty: *, ordType: undefined, text: string}}
     */
    static createOrderBody(order) {
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
        } else if(order.type === 'market') {
            orderType = 'Market'
        }

        if (!orderType) {
            throw 'Invalid order type'
        }

        let body = {
            'symbol': order.symbol,
            'qty': Math.abs(order.amount),
            'order_type': orderType,
            'time_in_force': 'GoodTillCancel',
        }

        if (order.options && order.options.post_only === true) {
            body['time_in_force'] = 'PostOnly';
        }

        if (order.options && order.options.close === true &&  orderType === 'Limit') {
            body['reduce_only'] = true
        }

        if (order.options && order.options.close === true && orderType === 'Stop') {
            body['close_on_trigger'] = true
        }

        if (orderType === 'Stop') {
            body['stop_px'] = Math.abs(order.price)
        } else if(orderType === 'Limit') {
            body['price'] = Math.abs(order.price)
        }

        body['side'] = order.price < 0 ? 'Sell' : 'Buy'

        if (order.id) {
            body['order_link_id'] = order.id
        }

        // conditional stop is market
        if (orderType === 'Stop') {
            body['order_type'] = 'Market';
        }

        return body
    }

    getBaseUrl() {
        return 'https://api.bybit.com'
    }
}
