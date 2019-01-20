let assert = require('assert')
let PairStateExecution = require('../../../modules/pairs/pair_state_execution')

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
            {'calculateOrderSize': () => { return 1337 }},
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
            {'calculateOrderSize': () => { return 1337 }},
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
            {'calculateOrderSize': () => { return 1337 }},
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
            {'calculateOrderSize': () => { return 1337 }},
            {'executeOrder': (exchange, order) => { myOrder = order; return undefined}},
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
            {'calculateOrderSize': () => { return 1337 }},
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

        let executor = new PairStateExecution(
            undefined,
            {
                'get': () => {
                    return {'calculateAmount': v => v }
                },
            },
            {'calculateOrderSize': () => { return 1337 }},
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
})
