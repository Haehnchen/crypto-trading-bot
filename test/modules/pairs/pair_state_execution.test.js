let assert = require('assert')
let PairStateExecution = require('../../../modules/pairs/pair_state_execution')
let ExchangeOrder = require('../../../dict/exchange_order')
let Position = require('../../../dict/position');

describe('#pair state execution', function() {
    it('test limit open order trigger for long', async () => {
        let myOrder = undefined

        let executor = new PairStateExecution(
            undefined,
            undefined,
            {'calculateOrderSize': () => { return 1337 }},
            {'executeOrder': (exchange, order) => { myOrder = order; return undefined}},
            undefined,
        )

        await executor.executeOrder('exchange', 'BTCUSD', 'long', {})

        assert.equal(myOrder.symbol, 'BTCUSD')
        assert.equal(myOrder.side, 'long')
        assert.equal(myOrder.price, undefined)
        assert.equal(myOrder.amount, 1337)
        assert.equal(myOrder.type, 'limit')
        assert.equal(myOrder.options.post_only, true)
        assert.equal(myOrder.hasAdjustedPrice(), true)
    })

    it('test limit open order trigger for long (market)', async () => {
        let myOrder = undefined

        let executor = new PairStateExecution(
            undefined,
            undefined,
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': (exchange, order) => { myOrder = order; return undefined}},
            undefined,
        )

        await executor.executeOrder('exchange', 'BTCUSD', 'long', {'market': true})

        assert.equal(myOrder.symbol, 'BTCUSD')
        assert.equal(myOrder.side, 'long')
        assert.equal(myOrder.price > 0, true)
        assert.equal(myOrder.amount, 1337)
        assert.equal(myOrder.type, 'market')
        assert.equal(myOrder.hasAdjustedPrice(), false)
    })

    it('test limit open order trigger for short', async () => {
        let myOrder = undefined

        let executor = new PairStateExecution(
            undefined,
            undefined,
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': (exchange, order) => { myOrder = order; return undefined}},
            undefined,
        )

        await executor.executeOrder('exchange', 'BTCUSD', 'short', {})

        assert.equal(myOrder.symbol, 'BTCUSD')
        assert.equal(myOrder.side, 'short')
        assert.equal(myOrder.price, undefined)
        assert.equal(myOrder.amount, -1337)
        assert.equal(myOrder.type, 'limit')
        assert.equal(myOrder.options.post_only, true)
        assert.equal(myOrder.hasAdjustedPrice(), true)
    })

    it('test limit open order trigger for long (short)', async () => {
        let myOrder = undefined

        let executor = new PairStateExecution(
            undefined,
            undefined,
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': (exchange, order) => { myOrder = order; return undefined}},
            undefined,
        )

        await executor.executeOrder('exchange', 'BTCUSD', 'short', {'market': true})

        assert.equal(myOrder.symbol, 'BTCUSD')
        assert.equal(myOrder.side, 'short')
        assert.equal(myOrder.price < 0, true)
        assert.equal(myOrder.amount, -1337)
        assert.equal(myOrder.type, 'market')
        assert.equal(myOrder.hasAdjustedPrice(), false)
    })

    it('test limit close order trigger for long', async () => {
        let myOrder = undefined

        let executor = new PairStateExecution(
            undefined,
            {
                'get': () => {
                    return {'calculateAmount': v => v }
                },
            },
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': async (exchange, order) => { myOrder = order; return undefined}},
            undefined,
        )

        await executor.executeCloseOrder('exchange', 'BTCUSD', 1337, {})

        assert.equal(myOrder.symbol, 'BTCUSD')
        assert.equal(myOrder.side, 'long')
        assert.equal(myOrder.price, undefined)
        assert.equal(myOrder.amount, 1337)
        assert.equal(myOrder.type, 'limit')
        assert.equal(myOrder.options.post_only, true)
        assert.equal(myOrder.hasAdjustedPrice(), true)
    })

    it('test market close order trigger for long', async () => {
        let myOrder = undefined

        let executor = new PairStateExecution(
            undefined,
            {
                'get': () => {
                    return {'calculateAmount': v => v }
                },
            },
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': (exchange, order) => { myOrder = order; return undefined}},
            undefined,
        )

        await executor.executeCloseOrder('exchange', 'BTCUSD', 1337, {'market': true})

        assert.equal(myOrder.symbol, 'BTCUSD')
        assert.equal(myOrder.side, 'long')
        assert.equal(myOrder.price > 0, true)
        assert.equal(myOrder.amount, 1337)
        assert.equal(myOrder.type, 'market')
        assert.deepEqual(myOrder.options, {})
    })

    it('test market close order trigger for short', async () => {
        let myOrder = undefined

        let logMessages = {
            'info': [],
            'error': [],
        }

        let executor = new PairStateExecution(
            undefined,
            {
                'get': () => {
                    return {'calculateAmount': v => v }
                },
            },
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': (exchange, order) => { myOrder = order; return undefined}},
            undefined,
        )

        await executor.executeCloseOrder('exchange', 'BTCUSD', -1337, {'market': true})

        assert.equal(myOrder.symbol, 'BTCUSD')
        assert.equal(myOrder.side, 'short')
        assert.equal(myOrder.price < 0, true)
        assert.equal(myOrder.amount, -1337)
        assert.equal(myOrder.type, 'market')
        assert.deepEqual(myOrder.options, {})
    })

    it('test buy/sell directly filled', async () => {
        let clearCalls = []

        let logMessages = {
            'info': [],
        }

        let executor = new PairStateExecution(
            {
                'clear': (exchange, symbol) => { clearCalls.push([exchange, symbol]) },
            },
            {
                'getPosition': async () => undefined,
                'getOrders': async () => [],
            },
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': async () => new ExchangeOrder('foobar', 'ADAUSDT', 'done', undefined, undefined, undefined, undefined, 'buy')},
            {
                'info': message => { logMessages['info'].push(message) },
            }
        )

        await executor.onSellBuyPair({'exchange': 'foobar', 'symbol': 'ADAUSDT'}, 'long')

        assert.strictEqual(clearCalls[0][0], 'foobar')
        assert.strictEqual(clearCalls[0][1], 'ADAUSDT')

        assert.strictEqual(logMessages['info'].filter(msg => msg.includes('position open order')).length, 1)
        assert.strictEqual(logMessages['info'].filter(msg => msg.includes('directly filled clearing state')).length, 1)
    })

    it('test buy/sell rejected and state is cleared', async () => {
        let clearCalls = []

        let logMessages = {
            'info': [],
            'error': [],
        }

        let executor = new PairStateExecution(
            {
                'clear': (exchange, symbol) => { clearCalls.push([exchange, symbol]) },
            },
            {
                'getPosition': async () => undefined,
                'getOrders': async () => [],
            },
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': async () => new ExchangeOrder('foobar', 'ADAUSDT', ExchangeOrder.STATUS_REJECTED, undefined, undefined, false, undefined, 'buy')},
            {
                'info': message => { logMessages['info'].push(message) },
                'error': message => { logMessages['error'].push(message) },
            }
        )

        await executor.onSellBuyPair({'exchange': 'foobar', 'symbol': 'ADAUSDT'}, 'long')

        assert.strictEqual(clearCalls[0][0], 'foobar')
        assert.strictEqual(clearCalls[0][1], 'ADAUSDT')

        assert.strictEqual(logMessages['info'].filter(msg => msg.includes('position open order')).length, 1)
        assert.strictEqual(logMessages['error'].filter(msg => msg.includes('order rejected clearing pair state')).length, 1)
    })

    it('test buy/sell directly filled for closing an order', async () => {
        let clearCalls = []

        let logMessages = {
            'info': [],
        }

        let executor = new PairStateExecution(
            {
                'clear': (exchange, symbol) => { clearCalls.push([exchange, symbol]) },
            },
            {
                'getPosition': async () => new Position('ADAUSDT', 'long', 1337),
                'getOrders': async () => [],
                'get': () => {
                    return {'calculateAmount': v => v }
                },
            },
            {'calculateOrderSize': async () => { return 1337 }},
            {'executeOrder': async () => new ExchangeOrder('foobar', 'ADAUSDT', 'done', undefined, undefined, undefined, undefined, 'buy')},
            {
                'info': message => { logMessages['info'].push(message) },
            }
        )

        await executor.onClosePair({'exchange': 'foobar', 'symbol': 'ADAUSDT'})

        assert.strictEqual(clearCalls[0][0], 'foobar')
        assert.strictEqual(clearCalls[0][1], 'ADAUSDT')

        assert.strictEqual(logMessages['info'].filter(msg => msg.includes('position close order')).length, 1)
        assert.strictEqual(logMessages['info'].filter(msg => msg.includes('directly filled clearing state')).length, 1)
    })
})
