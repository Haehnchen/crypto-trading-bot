let Order = require('../../dict/order')
let assert = require('assert')

describe('#order dict test', function() {
    it('test order dict creation (post only)', () => {
        let order = Order.createLimitPostOnlyOrder('BTCUSD', 'long', 12, 12, {'foobar': 'test'})

        assert.equal(order.options.foobar, "test")
        assert.equal(order.options.post_only, true)

    })

    it('test order dict creation (post only + adjusted)', () => {
        let order = Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder('BTCUSD', 'long', 12)

        assert.equal(order.price,undefined)
        assert.equal(order.options.adjust_price, true)

        assert.equal(order.hasAdjustedPrice(), true)
    })
})
