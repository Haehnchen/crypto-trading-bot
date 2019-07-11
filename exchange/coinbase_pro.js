'use strict';

const Gdax = require('coinbase-pro');

let Candlestick = require('./../dict/candlestick');
let Ticker = require('./../dict/ticker');
let CandlestickEvent = require('./../event/candlestick_event');
let TickerEvent = require('./../event/ticker_event');
let OrderUtil = require('../utils/order_util');
let Resample = require('../utils/resample');
let ExchangeOrder = require('../dict/exchange_order');
let Position = require('../dict/position');
let Order = require('../dict/order');
let moment = require('moment');

module.exports = class CoinbasePro {
    constructor(eventEmitter, logger, candlestickResample, queue) {
        this.eventEmitter = eventEmitter;
        this.queue = queue;
        this.logger = logger;
        this.candlestickResample = candlestickResample;

        this.client = undefined;

        this.orders = {};
        this.exchangePairs = {};
        this.symbols = {};
        this.tickers = {};
        this.fills = {};
        this.balances = [];

        this.candles = {};
        this.lastCandleMap = {};
        this.intervals = []
    }

    start(config, symbols) {
        this.symbols = symbols;
        this.candles = {};
        this.orders = {};
        this.exchangePairs = {};
        this.lastCandleMap = {};
        this.tickers = {};
        this.fills = {};
        this.balances = [];
        this.intervals = [];

        let eventEmitter = this.eventEmitter;

        let wsAuth = {};

        let channels = ['ticker', 'matches'];

        let isAuth = false;

        if (config['key'] && config['secret'] && config['passphrase'] && config['key'].length > 0 && config['secret'].length > 0 && config['passphrase'].length > 0) {
            isAuth = true;
            // for user related websocket actions
            channels.push('user');

            this.client = this.client = new Gdax.AuthenticatedClient(
                config['key'],
                config['secret'],
                config['passphrase'],
            );

            wsAuth = {
                key: config['key'],
                secret: config['secret'],
                passphrase: config['passphrase'],
            };

            this.logger.info('Coinbase Pro: Using AuthenticatedClient')
        } else {
            this.client = new Gdax.PublicClient();
            this.logger.info('Coinbase Pro: Using PublicClient')
        }

        const websocket = new Gdax.WebsocketClient(
            symbols.map(s => s.symbol),
            undefined,
            wsAuth,
            { 'channels': channels},
        );

        symbols.forEach(symbol => {
            symbol['periods'].forEach(interval => this.queue.add(async () => {
                // backfill
                let granularity = Resample.convertPeriodToMinute(interval) * 60;

                let candles;
                try {
                    candles = await this.client.getProductHistoricRates(symbol['symbol'], {granularity: granularity})
                } catch (e) {
                    me.logger.error('Coinbase Pro: candles fetch error: ' + JSON.stringify([symbol['symbol'], interval, String(e)]));
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
                );

                eventEmitter.emit('candlestick', new CandlestickEvent('coinbase_pro', symbol['symbol'], interval, ourCandles));
            }))
        });

        let me = this;

        // let websocket bootup
        setTimeout(() => {
            this.intervals.push(setInterval(function f() {
                me.syncPairInfo();
                return f
            }(), 60 * 60 * 15 * 1000));

            // user endpoints
            if (isAuth) {
                this.intervals.push(setInterval(function f() {
                    me.syncOrders();
                    return f
                }(), 1000 * 29));

                this.intervals.push(setInterval(function f() {
                    me.syncFills();
                    return f
                }(), 1000 * 31));

                this.intervals.push(setInterval(function f() {
                    me.syncBalances();
                    return f
                }(), 1000 * 32))
            }
        }, 5000);

        websocket.on('message', async data => {
            if (data.type && data.type === 'ticker') {
                let ticker = this.tickers[data['product_id']] = new Ticker(this.getName(), data['product_id'], moment().format('X'), data['best_bid'], data['best_ask']);

                eventEmitter.emit('ticker', new TickerEvent(
                    this.getName(),
                    data['product_id'],
                    ticker
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
                await Promise.all([
                    this.syncOrders(),
                    this.syncFills(data.product_id)
                ])
            }

            // we ignore "last_match". its not in our range
            if (data.type && ['match'].includes(data.type)) {
                let resamples = [];

                let symbolCfg = symbols.find(symbol => symbol.symbol === data.product_id);
                if (symbolCfg) {
                    resamples = symbolCfg['periods']
                }

                me.onTrade(data, '1m', resamples)
            }
        });

        websocket.on('error', err => {
            this.logger.error('Coinbase Pro: Error ' + JSON.stringify(err))
        });

        websocket.on('close', () => {
            this.logger.error('Coinbase Pro: closed');

            for (let interval of this.intervals) {
                clearInterval(interval)
            }

            this.intervals = [];

            // reconnect after close, after some waiting time
            setTimeout(() => {
                this.logger.info('Coinbase Pro: reconnect');

                me.start(config, symbols)
            }, 1000 * 30)
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
        msg.price = parseFloat(msg.price);
        msg.size = parseFloat(msg.size);

        let productId = msg.product_id;

        // Round the time to the nearest minute, Change as per your resolution
        let periodMinutes = Resample.convertPeriodToMinute(period);
        let roundedTime = Math.floor(new Date(msg.time) / 60000.0) * (periodMinutes * 60);

        // If the candles hashmap doesnt have this product id create an empty object for that id
        if (!this.candles[productId]) {
            this.candles[productId] = {}
        }

        // candle still open just modify it
        if (this.candles[productId][roundedTime]) {
            // If this timestamp exists in our map for the product id, we need to update an existing candle
            let candle = this.candles[productId][roundedTime];

            candle.high = msg.price > candle.high ? msg.price : candle.high;
            candle.low = msg.price < candle.low ? msg.price : candle.low;
            candle.close = msg.price;
            candle.baseVolume = parseFloat((candle.baseVolume + msg.size).toFixed(8));

            // Set the last candle as the one we just updated
            this.lastCandleMap[productId] = candle;

            return
        }

        //Before creating a new candle, lets mark the old one as closed
        let lastCandle = this.lastCandleMap[productId];

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
        };

        let ourCandles = [];
        for (let timestamp in this.candles[productId]) {
            let candle = this.candles[productId][timestamp];

            ourCandles.push(new Candlestick(
                candle.timestamp,
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.baseVolume,
            ))
        }

        this.eventEmitter.emit('candlestick', new CandlestickEvent('coinbase_pro', msg.product_id, period, ourCandles));

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
            let orders = [];

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
        let capitals = {};
        this.symbols
            .filter(s => s.trade && ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0)))
            .forEach(s => {
                if (s.trade.capital > 0) {
                    capitals[s.symbol] = s.trade.capital
                } else if (s.trade.currency_capital > 0 && this.tickers[s.symbol]  && this.tickers[s.symbol].bid) {
                    capitals[s.symbol] = s.trade.currency_capital / this.tickers[s.symbol].bid
                }
            });

        let positions = [];
        for (let balance of this.balances) {
            let asset = balance.currency;

            for (let pair in capitals) {
                if (!pair.startsWith(asset)) {
                    continue
                }

                let capital = capitals[pair];
                let balanceUsed = parseFloat(balance.balance);

                // 1% balance left indicate open position
                if (Math.abs(balanceUsed / capital) <= 0.1) {
                    continue
                }

                let entry;
                let createdAt = new Date();
                let profit;

                // try to find a entry price, based on trade history
                if (this.fills[pair] && this.fills[pair][0]) {
                    let result = CoinbasePro.calculateEntryOnFills(this.fills[pair])
                    if (result) {
                        createdAt = new Date(result['created_at']);
                        entry = result['average_price']

                        // calculate profit based on the ticket price
                        if (this.tickers[pair] && this.tickers[pair].bid) {
                            profit = ((this.tickers[pair].bid / result['average_price']) - 1) * 100
                        }
                    }
                }

                positions.push(new Position(pair, 'long', balanceUsed, profit, new Date(), entry, createdAt))
            }
        }

        return positions
    }

    static calculateEntryOnFills(fills, balance) {
        let result = {
            'size': 0,
            'costs': 0,
        };

        for (let fill of fills) {
            // stop if last fill is a sell
            if (fill.side !== 'buy') {
                break;
            }

            // stop if price out of range window
            let number = result.size + parseFloat(fill.size);
            if (number > balance * 1.15) {
                break;
            }

            result.size += parseFloat(fill.size);
            result.costs += (parseFloat(fill.size) * parseFloat(fill.price)) + parseFloat(fill.fee)

            result['created_at'] = fill.created_at
        }

        result['average_price'] = result.costs / result.size

        if (result.size === 0 || result.costs === 0) {
            return undefined;
        }

        return result
    }

    async getPositionForSymbol(symbol) {
        return (await this.getPositions()).find(position => {
            return position.symbol === symbol
        })
    }

    async syncOrders() {
        let ordersRaw = [];

        try {
            ordersRaw = await this.client.getOrders({status: 'open'})
        } catch (e) {
            this.logger.error('Coinbase Pro: orders ' + String(e));
            return
        }

        let orders = {};
        CoinbasePro.createOrders(...ordersRaw).forEach(o => {
            orders[o.id] = o
        });

        this.orders = orders
    }

    async syncBalances() {
        let accounts = undefined;
        try {
            accounts = await this.client.getAccounts()
        } catch (e) {
            this.logger.error('Coinbase Pro: balances ' + String(e));
            return
        }

        if (!accounts) {
            return
        }

        this.balances = accounts.filter(b => parseFloat(b.balance) > 0);
        this.logger.debug('Coinbase Pro: Sync balances ' + this.balances.length)
    }

    async syncFills(productId = undefined) {
        let symbols = [];

        if (productId) {
            symbols.push(productId)
        } else {
            symbols = this.symbols
                .filter(s => s.trade && ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0)))
                .map(x => {
                    return x.symbol
                })
        }

        this.logger.debug('Coinbase Pro: Syncing fills: ' +  JSON.stringify([symbols]));

        for (let symbol of symbols) {
            try {
                this.fills[symbol] = (await this.client.getFills({'product_id': symbol})).slice(0, 15)
            } catch (e) {
                this.logger.error('Coinbase Pro: fill sync error:' + JSON.stringify([symbol, e.message]))
            }
        }
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

    async order(order) {
        let payload = CoinbasePro.createOrderBody(order);
        let result = undefined;

        try {
            result = await this.client.placeOrder(payload)
        } catch (e) {
            this.logger.error('Coinbase Pro: order create error: ' + e.message);

            if(e.message && (e.message.match(/HTTP\s4\d{2}/i) || e.message.toLowerCase().includes('size is too accurate') || e.message.toLowerCase().includes('size is too small') )) {
                return ExchangeOrder.createRejectedFromOrder(order);
            }

            return
        }

        let exchangeOrder = CoinbasePro.createOrders(result)[0];

        this.triggerOrder(exchangeOrder);
        return exchangeOrder
    }

    async cancelOrder(id) {
        let orderId;

        try {
            orderId = await this.client.cancelOrder(id)
        } catch (e) {
            this.logger.error('Coinbase Pro: cancel order error: ' + e);
            return
        }

        delete this.orders[orderId]
    }

    async cancelAll(symbol) {
        let orderIds;
        try {
            orderIds = await this.client.cancelAllOrders({product_id: symbol})
        } catch (e) {
            this.logger.error('Coinbase Pro: cancel all order error: ' + String(e));
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
        };

        let orderType = undefined;
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

        myOrder['type'] = orderType;

        if (order.id) {
            // format issue
            // myOrder['client_oid'] = order.id
        }

        return myOrder
    }

    static createOrders(...orders) {
        return orders.map(order => {
            let retry = false;

            let status = undefined;
            let orderStatus = order['status'].toLowerCase();

            if (['open', 'active', 'pending'].includes(orderStatus)) {
                status = 'open'
            } else if (orderStatus === 'filled') {
                status = 'done'
            } else if (orderStatus === 'canceled') {
                status = 'canceled'
            } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
                status = 'rejected';
                retry = true
            }

            let ordType = order['type'].toLowerCase();

            // secure the value
            let orderType = undefined;
            switch (ordType) {
                case 'limit':
                    orderType = 'limit';
                    break;
                case 'stop':
                    orderType = 'stop';
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
        await this.cancelOrder(id);

        return await this.order(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount))
    }

    async syncPairInfo() {
        let pairs;
        try {
            pairs = await this.client.getProducts()
        } catch (e) {
            this.logger.error('Coinbase Pro: pair sync error: ' + e);

            return
        }

        let exchangePairs = {};
        pairs.forEach(pair => {
            exchangePairs[pair['id']] = {
                'tick_size': parseFloat(pair['quote_increment']),
                'lot_size': parseFloat(pair['quote_increment']),
            }
        });

        this.logger.info('Coinbase Pro: pairs synced: ' + pairs.length);
        this.exchangePairs = exchangePairs
    }

    getName() {
        return 'coinbase_pro'
    }
};
