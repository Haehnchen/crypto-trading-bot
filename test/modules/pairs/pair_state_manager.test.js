let assert = require('assert')
let PairStateManager = require('../../../modules/pairs/pair_state_manager')

describe('#pair state manager', function() {
    it('test pair state changes', () => {
        let manager = new PairStateManager(
            {'info': () => {}, 'debug': () => {}},
        )

        manager.update('foo1', 'BTCUSD2', 'long', {'foobar': 'test'})
        manager.update('foo2', 'BTCUSD3', 'short', {'foobar': 'test'})
        manager.update('foo3', 'BTCUSD4', 'close', {'foobar': 'test'})
        manager.update('foo4', 'BTCUSD5', 'cancel', {'foobar': 'test'})

        assert.equal(manager.isNeutral('foo', 'BTCUSD'), true)
        assert.equal(manager.get('foo1', 'BTCUSD2').exchange, 'foo1')

        assert.equal(manager.getBuyingPairs()[0].symbol, 'BTCUSD2')
        assert.equal(manager.getSellingPairs()[0].symbol, 'BTCUSD3')
        assert.equal(manager.getClosingPairs()[0].symbol, 'BTCUSD4')
        assert.equal(manager.getCancelPairs()[0].symbol, 'BTCUSD5')

        assert.equal(manager.isNeutral('foo1', 'BTCUSD2'), false)
        assert.equal(manager.isNeutral('foo2', 'BTCUSD3'), false)

        manager.clear('UNKNOWN', 'FOOBAR')
        manager.clear('foo2', 'BTCUSD3')

        assert.equal(manager.isNeutral('foo2', 'BTCUSD3'), true)
        assert.equal(manager.isNeutral('UNKNOWN', 'FOOBAR'), true)
    })
})
