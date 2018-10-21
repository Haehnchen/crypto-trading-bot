let assert = require('assert')
let orderUtil = require('../../utils/order_util')
let Position = require('../../dict/position')
let ExchangeOrder = require('../../dict/exchange_order')

describe('#order util', function() {
    it('calculate order amount', () => {
        assert.equal(0.01540120, orderUtil.calculateOrderAmount(6493, 100).toFixed(8))
    });

    it('sync stoploss exchange order (long)', () => {
        let position = new Position('LTCUSD', 'long', 4, 0, new Date())

        // stop loss create
        assert.deepEqual([{ amount: 4}], orderUtil.syncStopLossOrder(position, []))

        // stop loss update
        assert.deepEqual([{id: 'foobar', amount: 4 }], orderUtil.syncStopLossOrder(position, [
            new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'stop')
        ]))

        // stop loss: missing value
        assert.deepEqual([{id: 'foobar', amount: 4 }], orderUtil.syncStopLossOrder(position, [
            new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'limit'),
            new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, -2, false, 'our_id', 'buy', 'stop'),
        ]))

        assert.deepEqual([{id: 'foobar', amount: 4 }], orderUtil.syncStopLossOrder(position, [
            new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'limit'),
            new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, -5, false, 'our_id', 'buy', 'stop'),
        ]))

        // stop loss correct
        assert.deepEqual([], orderUtil.syncStopLossOrder(position, [
            new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'limit'),
            new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, -4, false, 'our_id', 'buy', 'stop'),
        ]))
    })

    it('sync stoploss exchange order (short)', () => {
        let position = new Position('LTCUSD', 'short', -4, 0, new Date())

        // stop loss update
        assert.deepEqual([], orderUtil.syncStopLossOrder(position, [
            new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 4, false, 'our_id', 'buy', 'stop')
        ]))
    })

    it('calculate increment size', () => {
        assert.equal(0.00857, orderUtil.calculateNearestSize(0.0085696, 0.00001))
        assert.equal(50, orderUtil.calculateNearestSize(50.55, 2.5))

        assert.equal(50, orderUtil.calculateNearestSize(50.22, 1))
        assert.equal(51, orderUtil.calculateNearestSize(50.88, 1))
    })
})
