let assert = require('assert');
let Binance = require('../../exchange/binance');
let Order = require('../../dict/order');
let Position = require('../../dict/position');
let Ticker = require('../../dict/ticker');
let ExchangeOrder = require('../../dict/exchange_order');

let fs = require('fs');

describe('#binance exchange implementation', function() {
    it('limit order is created', () => {
        let orders = Binance.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'long', 1337, 0.5))

        delete orders['newClientOrderId']

        assert.deepEqual(
            {
                'symbol': 'BTCUSD',
                'quantity': 0.5,
                'side': 'BUY',
                'price': 1337,
                'type': 'LIMIT'
            },
            orders
        )
    })

    it('market order is created', () => {
        let orders = Binance.createOrderBody(Order.createMarketOrder('BTCUSD', -1337))

        delete orders['newClientOrderId']

        assert.deepEqual(
            {
                'quantity': 1337,
                'side': 'SELL',
                'symbol': 'BTCUSD',
                'type': 'MARKET',
            },
            orders
        )
    })

    it('stop order is created', () => {
        let orders = Binance.createOrderBody(Order.createStopLossOrder('BTCUSD', -1337 , 12))

        delete orders['newClientOrderId']

        assert.deepEqual(
            {
                'stopPrice': 1337,
                'quantity': 12,
                'side': 'SELL',
                'symbol': 'BTCUSD',
                'type': 'STOP_LOSS',
            },
            orders
        )
    })

    it('order creation', async () => {
        let binance = new Binance()
        binance.client = {
            'order': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'XLMETH',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e',
                    transactTime: 1514418413947,
                    price: '0.00020000',
                    origQty: '100.10000000',
                    executedQty: '0.00000000',
                    status: 'NEW',
                    timeInForce: 'GTC',
                    type: 'LIMIT',
                    side: 'BUY'
                })
            }) }
        }

        assert.equal(0, (await binance.getOrders()).length)

        let order = await binance.order(Order.createStopLossOrder('BTCUSD', -1337 , 12))

        assert.equal(1740797, order.id)
        assert.equal('XLMETH', order.symbol)
        assert.equal('open', order.status)
        assert.equal('0.00020000', order.price)
        assert.equal(100.1, order.amount)
        assert.equal(false, order.retry)
        assert.equal('1XZTVBTGS4K1e', order.ourId)
        assert.equal('buy', order.side)
        assert.equal('limit', order.type)
        assert.equal('0.00000000', order.raw['executedQty'])

        assert.equal(1, (await binance.getOrders()).length)
        assert.equal(1, (await binance.getOrdersForSymbol('XLMETH')).length)
        assert.equal(0, (await binance.getOrdersForSymbol('FOOBAR')).length)

        assert.equal('1XZTVBTGS4K1e', (await binance.findOrderById(1740797)).ourId)
    })

    it('order creation cases', async () => {
        let binance = new Binance()
        binance.client = {
            'order': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'XLMETH',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e',
                    transactTime: 1514418413947,
                    price: '0.00020000',
                    origQty: '100.10000000',
                    executedQty: '0.00000000',
                    status: 'PARTIALLY_FILLED',
                    timeInForce: 'GTC',
                    type: 'STOP_LOSS',
                    side: 'SELL'
                })
            }) }
        }

        let order = await binance.order(Order.createStopLossOrder('BTCUSD', -1337 , 12))

        assert.equal('open', order.status)
        assert.equal('sell', order.side)
        assert.equal('stop', order.type)
        assert.equal(true, order.createdAt instanceof Date)
        assert.equal(true, order.updatedAt instanceof Date)
    })

    it('order cancel order', async () => {
        let binance = new Binance()
        binance.client = {
            'order': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'BTCUSD',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e',
                    transactTime: 1514418413947,
                    price: '0.00020000',
                    origQty: '100.10000000',
                    executedQty: '0.00000000',
                    status: 'PARTIALLY_FILLED',
                    timeInForce: 'GTC',
                    type: 'STOP_LOSS',
                    side: 'SELL'
                })
            }) },
            'cancelOrder': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'BTCUSD',
                    origClientOrderId: '1XZTVBTGS4K1e',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e'
                })
            }) }
        }

        await binance.order(Order.createStopLossOrder('BTCUSD', -1337 , 12))
        assert.equal(1, (await binance.getOrders()).length)
        assert.equal(1, (await binance.getOrdersForSymbol('BTCUSD')).length)

        let order = await binance.cancelOrder(1740797)

        assert.equal(1740797, order.id)
        assert.equal('canceled', order.status)
    })

    it('order cancelAll orders', async () => {
        let binance = new Binance()
        binance.client = {
            'order': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'BTCUSD',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e',
                    transactTime: 1514418413947,
                    price: '0.00020000',
                    origQty: '100.10000000',
                    executedQty: '0.00000000',
                    status: 'PARTIALLY_FILLED',
                    timeInForce: 'GTC',
                    type: 'STOP_LOSS',
                    side: 'SELL'
                })
            }) },
            'cancelOrder': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'BTCUSD',
                    origClientOrderId: '1XZTVBTGS4K1e',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e'
                })
            }) }
        }

        await binance.order(Order.createStopLossOrder('BTCUSD', -1337 , 12))
        assert.equal(1, (await binance.getOrders()).length)
        assert.equal(1, (await binance.getOrdersForSymbol('BTCUSD')).length)

        let orders = await binance.cancelAll('BTCUSD')

        assert.equal('canceled', orders[0].status)

        assert.equal(0, (await binance.getOrders()).length)
        assert.equal(0, (await binance.getOrdersForSymbol('BTCUSD')).length)
    })

    it('test that positions are open based on websocket balances', async () => {
        let binance = new Binance(
            undefined,
            {'debug': () => {}}
        )

        binance.symbols = [
            {
                'symbol': 'BTCUSDT',
                'trade': {
                    'capital': 0.008,
                },
            }
        ]

        binance.tickers['BTCUSDT'] = new Ticker('foobar', 'BTCUSD', undefined, 1331, 1332)

        binance.client = {
            'allOrders': async () => {
                return [
                    {
                        symbol: 'BTCUSDT',
                        orderId: 1740797,
                        clientOrderId: '1XZTVBTGS4K1e',
                        transactTime: 1514418413947,
                        price: '1337.123',
                        origQty: '1337.123',
                        executedQty: '0.00000000',
                        status: 'FILLED',
                        timeInForce: 'GTC',
                        type: 'LIMIT',
                        side: 'BUY'
                    }
                ]
            }
        }

        await binance.onWebSocketEvent(getEvent(event => event.eventType === 'account'))

        let balances = binance.balances

        assert.equal(balances.length, 23)
        assert.equal(balances.find(balance => balance.asset === 'USDT').available > 1, true)

        await binance.syncTradesForEntries()

        let BTCUSDT = await binance.getPositionForSymbol('BTCUSDT')

        assert.equal(BTCUSDT.amount > 0.008, true)
        assert.equal(BTCUSDT.profit < 1, true)
    })

    it('test that positions are open based on websocket balances with currency capital', async () => {
        let binance = new Binance(
            undefined,
            {'debug': () => {}}
        )

        binance.symbols = [
            {
                'symbol': 'BTCUSDT',
                'trade': {
                    'currency_capital': 50,
                },
            }
        ]

        binance.tickers['BTCUSDT'] = new Ticker('foobar', 'BTCUSD', undefined, 1331, 1332)

        binance.client = {
            'allOrders': async () => {
                return [
                    {
                        symbol: 'BTCUSDT',
                        orderId: 1740797,
                        clientOrderId: '1XZTVBTGS4K1e',
                        transactTime: 1514418413947,
                        price: '1337.123',
                        origQty: '1337.123',
                        executedQty: '0.00000000',
                        status: 'FILLED',
                        timeInForce: 'GTC',
                        type: 'LIMIT',
                        side: 'BUY'
                    }
                ]
            }
        }

        await binance.onWebSocketEvent(getEvent(event => event.eventType === 'account'))

        let balances = binance.balances

        assert.equal(balances.length, 23)
        assert.equal(balances.find(balance => balance.asset === 'USDT').available > 1, true)

        await binance.syncTradesForEntries()

        let BTCUSDT = await binance.getPositionForSymbol('BTCUSDT')

        assert.equal(BTCUSDT.amount > 0.008, true)
        assert.equal(BTCUSDT.profit < 1, true)
    })

    it('test websocket order events with cancel state', async () => {
        let binance = new Binance(
            undefined,
            {'debug': () => {}, 'error': () => {}}
        )

        binance.symbols = [
            {
                'symbol': 'BTCUSDT',
                'trade': {
                    'capital': 0.008,
                },
            }
        ]

        let calls = []
        binance.client = {
            'allOrders': async (arg) => { calls.push(arg); return []},
            'openOrders': async () => { throw 'Connection issue' }
        }

        binance.triggerOrder(new ExchangeOrder('25035356', 'BTCUSDT', 'open', undefined, undefined, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT))
        binance.triggerOrder(new ExchangeOrder('foobar', 'ADAUSDT', 'open', undefined, undefined, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT))

        assert.equal(Object.keys(binance.orders).length, 2)
        assert.equal(binance.orders[25035356].symbol, 'BTCUSDT')

        await binance.onWebSocketEvent(getEvent(event => event.orderId === 25035356))
        assert.equal(binance.orders[25035356], undefined)
        assert.equal(Object.keys(binance.orders).length, 1)

        assert.deepEqual(calls, [{
            "symbol": "ONTUSDT",
            "limit": 150
        }])
    })

    it('test websocket order events with filled state', async () => {
        let binance = new Binance(
            undefined,
            {'debug': () => {}, 'error': () => {}}
        )

        binance.symbols = [
            {
                'symbol': 'BTCUSDT',
                'trade': {
                    'capital': 0.008,
                },
            }
        ]

        let calls = []
        binance.client = {
            'allOrders': async (arg) => { calls.push(arg); return []},
            'openOrders': async () => { throw 'Connection issue' }
        }

        binance.triggerOrder(new ExchangeOrder('25035356', 'BTCUSDT', 'open', undefined, undefined, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT))
        binance.triggerOrder(new ExchangeOrder('foobar', 'ADAUSDT', 'open', undefined, undefined, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT))

        assert.equal(Object.keys(binance.orders).length, 2)
        assert.equal(binance.orders[25035356].symbol, 'BTCUSDT')

        await binance.onWebSocketEvent(getEvent(event => event.orderId === 25035368))

        assert.equal(binance.trades['ONTUSDT'].side, 'buy')
        assert.strictEqual(binance.trades['ONTUSDT'].price, 0.5448)
        assert.equal(binance.trades['ONTUSDT'].symbol, 'ONTUSDT')

        assert.deepEqual(calls, [{
            "symbol": "ONTUSDT",
            "limit": 150
        }])
    })

    it('test init of balances via account info', async () => {
        let binance = new Binance(
            undefined,
            {'debug': () => {}}
        )

        binance.client = {
            'accountInfo': async () => JSON.parse(fs.readFileSync(__dirname + '/binance/account-info.json', 'utf8')),
        }

        await binance.syncBalances()

        let balances = binance.balances

        assert.equal(balances.length, 3)

        assert.equal(balances.find(balance => balance.asset === 'TNT').available > 0.1, true)
        assert.equal(balances.find(balance => balance.asset === 'TNT').locked > 1, true)
    })

    it('test placing order on balance issue', async () => {
        let binance = new Binance(
            undefined,
            {
                'error': () => {}
            }
        )

        binance.client = {
            'order': () => {throw new Error('Account has insufficient balance for requested action');}
        }

        let order = await binance.order(Order.createMarketOrder('FOOBAR', 12))

        assert.strictEqual(order.retry, false)
        assert.strictEqual(order.status, 'rejected')
        assert.strictEqual(order.symbol, 'FOOBAR')
        assert.strictEqual(order.amount, 12)
        assert.strictEqual(order.type, 'market')
    })

    let getEvent = function(find) {
        return JSON.parse(fs.readFileSync(__dirname + '/binance/events.json', 'utf8')).find(find)
    }
})
