let assert = require('assert')
let OrderExecutor = require('../../../modules/order/order_executor')
let Order = require('../../../dict/order')
let Ticker = require('../../../dict/ticker')
let ExchangeOrder = require('../../../dict/exchange_order')
const moment = require('moment')

describe('#order executor', () => {
    it('test order create execution', async () => {
        let exchangeOrders = [
            new ExchangeOrder('1815-1337-1', undefined, undefined, undefined, undefined, false, undefined, 'buy'),
        ]

        let configs = {
            'order.retry': 3,
            'order.retry_ms': 8,
        }

        let i = 0
        let executor = new OrderExecutor(
            {'get': () => { return {
                    'order': () => { return exchangeOrders[i++] },
                }}},
            undefined,
            {'getConfig': (key) => { return configs[key] }},
            {'info': () => {}, 'error': () => {}}
        )

        let result = await executor.executeOrder('foobar', Order.createLimitPostOnlyOrderAutoSide('BTCUSD', 1337, -10))

        assert.equal(i, 1)
        assert.equal(result.id, '1815-1337-1')
        assert.equal(executor.orders.find(o => o.id === '1815-1337-1').id, '1815-1337-1')
    })

    it('test order create execution with retry', async () => {
        let exchangeOrders = [
            new ExchangeOrder('1815-1337-1', undefined, undefined, undefined, undefined, true, undefined, 'buy'),
            new ExchangeOrder('1815-1337-2', undefined, undefined, undefined, undefined, true, undefined, 'buy'),
            new ExchangeOrder('1815-1337-3', undefined, undefined, undefined, undefined, true, undefined, 'buy'),
            new ExchangeOrder('1815-1337-4', undefined, undefined, undefined, undefined, false, undefined, 'buy'),
        ]

        let configs = {
            'order.retry': 3,
            'order.retry_ms': 8,
        }

        let i = 0
        let executor = new OrderExecutor(
            {'get': () => { return {
                'order': () => { return exchangeOrders[i++] },
            }}},
            undefined,
            {'getConfig': (key) => { return configs[key] }},
            {'info': () => {}, 'error': () => {}}
        )

        let result = await executor.executeOrder('foobar', Order.createLimitPostOnlyOrderAutoSide('BTCUSD', 1337, -10))

        assert.equal(i, 4)
        assert.equal(result.id, '1815-1337-4')

        assert.equal(executor.orders.find(o => o.id === '1815-1337-4').id, '1815-1337-4')
        assert.equal(executor.orders.find(o => o.id === '1815-1337-3'), undefined)
    })

    it('test order create execution with out of retry limit', async () => {
        let exchangeOrders = [
            new ExchangeOrder('1815-1337-1', undefined, undefined, undefined, undefined, true, undefined, 'buy'),
            new ExchangeOrder('1815-1337-2', undefined, undefined, undefined, undefined, true, undefined, 'buy'),
            new ExchangeOrder('1815-1337-3', undefined, undefined, undefined, undefined, true, undefined, 'buy'),
            new ExchangeOrder('1815-1337-4', undefined, undefined, undefined, undefined, true, undefined, 'buy'),
            new ExchangeOrder('1815-1337-4', undefined, undefined, undefined, undefined, true, undefined, 'buy'),
        ]

        let configs = {
            'order.retry': 3,
            'order.retry_ms': 8,
        }

        let i = 0
        let executor = new OrderExecutor(
            {'get': () => { return {
                    'order': () => { return exchangeOrders[i++] },
                }}},
            undefined,
            {'getConfig': (key) => { return configs[key] }},
            {'info': () => {}, 'error': () => {}}
        )

        let result = await executor.executeOrder('foobar', Order.createLimitPostOnlyOrderAutoSide('BTCUSD', 1337, -10))

        assert.equal(i, 4)
        assert.equal(result, undefined)
        assert.equal(executor.orders.length, 0)
    })

    it('test that adjust price handler must clean up unknown orders', async () => {
        let exchangeOrder = new ExchangeOrder('1815-1337', undefined, undefined, undefined, undefined, undefined, undefined, 'buy')

        let executor = new OrderExecutor(
            {'get': () => { return {'findOrderById': () => { return exchangeOrder }} }},
            undefined,
            undefined,
            {'info': () => {}}
        )

        let order = Order.createCloseOrderWithPriceAdjustment('BTCUSD', 1337)

        executor.orders.push({
            'id': exchangeOrder.id,
            'order': order,
            'exchangeOrder': exchangeOrder
        })

        await executor.adjustOpenOrdersPrice()

        assert.equal(executor.orders.length, 0)
        assert.equal('1815-1337' in executor.runningOrders, false)
    })

    it('test that adjust price handler must clean up outdated managed orders', async () => {
        let executor = new OrderExecutor(
            undefined,
            undefined,
            undefined,
            undefined
        )

        // current
        executor.runningOrders['1815-1337'] = new Date()
        await executor.adjustOpenOrdersPrice()
        assert.equal('1815-1337' in executor.runningOrders, true)

        // outdated
        executor.runningOrders['1815-1337'] = moment().subtract(180, 'minutes')
        await executor.adjustOpenOrdersPrice()
        assert.equal('1815-1337' in executor.runningOrders, false)
    })

    it('test that price adjust order is created for long', async () => {
        let exchangeOrder = new ExchangeOrder('1815-1337', undefined, 'open', undefined, undefined, undefined, undefined, 'buy')

        let exchangeName = undefined
        let orderUpdate = undefined

        let executor = new OrderExecutor(
            {
                'get': () => { return {
                    'findOrderById': () => { return new Promise(resolve => {
                        resolve(exchangeOrder)
                    })},
                    'updateOrder': (myExchangeName, myOrderUpdate) => {
                        return new Promise(resolve => {
                            exchangeName = myExchangeName
                            orderUpdate = myOrderUpdate

                            resolve(exchangeOrder)
                        })
                    },
                }},
            },
            {'getIfUpToDate': () => { return new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338)}},
            undefined,
            {'info': () => {}, 'error': () => {}}
        )

        let order = Order.createCloseOrderWithPriceAdjustment('BTCUSD', 1337)

        executor.orders.push({
            'id': exchangeOrder.id,
            'order': order,
            'exchangeOrder': exchangeOrder
        })

        await executor.adjustOpenOrdersPrice()

        assert.equal(orderUpdate.price, 1337)
        assert.equal(Object.keys(executor.runningOrders).length, 0)
    })


    it('test that price adjust order is recreated on placing error', async () => {
        let exchangeOrder = new ExchangeOrder('1815-1337', undefined, 'open', 1331, undefined, false, undefined, 'buy')

        let exchangeName = undefined
        let orderUpdate = undefined

        let executor = new OrderExecutor(
            {
                'get': () => { return {
                    'findOrderById': () => { return new Promise(resolve => {
                        resolve(exchangeOrder)
                    })},
                    'updateOrder': (myExchangeName, myOrderUpdate) => {
                        return new Promise(resolve => {
                            exchangeName = myExchangeName
                            orderUpdate = myOrderUpdate

                            resolve(new ExchangeOrder('1815-1337', undefined, 'canceled', 1331, undefined, true, undefined, 'buy'))
                        })
                    },
                }},
            },
            {'getIfUpToDate': () => { return new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338)}},
            {'getConfig': (key, defaultValue) => defaultValue},
            {'info': () => {}, 'error': () => {}}
        )

        let retryOrder
        executor.executeOrder = async (exchange, order) => {
            retryOrder = order
        }

        let order = Order.createCloseOrderWithPriceAdjustment('BTCUSD', 1337)

        executor.orders.push({
            'id': exchangeOrder.id,
            'order': order,
            'exchangeOrder': exchangeOrder,
            'exchange': 'test',
        })

        await executor.adjustOpenOrdersPrice()

        assert.equal(retryOrder.amount, 1337)
        assert.equal(retryOrder.hasAdjustedPrice(), true)
    })

    it('test that price adjust order is created for short', async () => {
        let exchangeOrder = new ExchangeOrder('1815-1337', undefined, 'open', undefined, undefined, undefined, undefined, 'buy')

        let exchangeName = undefined
        let orderUpdate = undefined

        let executor = new OrderExecutor(
            {
                'get': () => { return {
                    'findOrderById': () => { return new Promise(resolve => {
                        resolve(exchangeOrder)
                    })},
                    'updateOrder': (myExchangeName, myOrderUpdate) => {
                        return new Promise(resolve => {
                            exchangeName = myExchangeName
                            orderUpdate = myOrderUpdate

                            resolve(exchangeOrder)
                        })
                    },
                }},
            },
            {'getIfUpToDate': () => { return new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338)}},
            undefined,
            {'info': () => {}, 'error': () => {}}
        )

        let order = Order.createCloseOrderWithPriceAdjustment('BTCUSD', -1337)

        executor.orders.push({
            'id': exchangeOrder.id,
            'order': order,
            'exchangeOrder': exchangeOrder
        })

        await executor.adjustOpenOrdersPrice()

        assert.equal(orderUpdate.price, -1338)
        assert.equal(Object.keys(executor.runningOrders).length, 0)
    })

    it('test that all orders are canceled', async () => {
        let mySymbol = undefined

        let executor = new OrderExecutor(
            {
                'get': () => { return {
                    'cancelAll': (symbol) => { return new Promise(resolve => {
                        mySymbol = symbol

                        resolve()
                    })},
                }},
            },
            {'getIfUpToDate': () => { return new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338)}},
            undefined,
            {'info': () => {}, 'error': () => {}}
        )

        await executor.cancelAll('FOO_EXCHANGE', 'test')

        assert.equal(mySymbol, 'test')
    })

    it('test that order is canceled', async () => {
        let mySymbol = undefined

        let executor = new OrderExecutor(
            {
                'get': () => { return {
                    'cancelOrder': (symbol) => { return new Promise(resolve => {
                        mySymbol = symbol

                        resolve()
                    })},
                }},
            },
            {'getIfUpToDate': () => { return new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338)}},
            undefined,
            {'info': () => {}, 'error': () => {}}
        )

        await executor.cancelOrder('FOO_EXCHANGE', '1337-ABCD')

        assert.equal(mySymbol, '1337-ABCD')
    })

    it('test that current price is injected by time', async () => {
        let i = 0

        let executor = new OrderExecutor(
            undefined,
            {'getIfUpToDate': () => {
                return i++ > 5 ? new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338) : undefined
            }},
            undefined,
            {'info': () => {}, 'error': () => {}}
        )

        executor.tickerPriceInterval = 2

        let price = await executor.getCurrentPrice('FOO_EXCHANGE', '1337-ABCD', 'short')

        assert.equal(i > 1, true)
        assert.equal(price, -1338)
    })
})
