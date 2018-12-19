let Order = require('../../dict/order')
let assert = require('assert')

describe('#order dict test', function() {
    it('test order dict creation (post only)', () => {
        let order = Order.createLimitPostOnlyOrder('BTCUSD', 'long', 12, 12, {'foobar': 'test'})

        assert.equal(order.options.foobar, "test")
        assert.equal(order.options.post_only, true)

    })

    it('test order dict creation (post only + adjusted) [long]', () => {
        let order = Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder('BTCUSD', 12)

        assert.equal(order.price,undefined)
        assert.equal(order.options.adjust_price, true)
        assert.equal(order.amount,12)
        assert.equal(order.side,'long')

        assert.equal(order.hasAdjustedPrice(), true)
    })

    it('test order dict creation (post only + adjusted) [short]', () => {
        let order = Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder('BTCUSD', -12)

        assert.equal(order.price,undefined)
        assert.equal(order.options.adjust_price, true)
        assert.equal(order.amount,-12)
        assert.equal(order.side,'short')

        assert.equal(order.hasAdjustedPrice(), true)
    })

    it('test order close creation', () => {
        let order = Order.createCloseOrderWithPriceAdjustment('BTCUSD', -12)

        assert.equal(order.price,undefined)
        assert.equal(order.options.adjust_price, true)
        assert.equal(order.options.close, true)

        assert.equal(order.side, 'short')
        assert.equal(order.hasAdjustedPrice(), true)
        assert.deepEqual(order.options, { close: true, adjust_price: true, post_only: true })

        assert.equal(Order.createCloseOrderWithPriceAdjustment('BTCUSD', 12).side, 'long')
    })

    it('test market order', () => {
        let order = Order.createMarketOrder('BTCUSD', -12)

        assert.equal(order.price < 0,true)
        assert.equal(order.side, 'short')

        order = Order.createMarketOrder('BTCUSD', 12)

        assert.equal(order.price > 0,true)
        assert.equal(order.side, 'long')
    })
})
