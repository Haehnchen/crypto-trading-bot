let assert = require('assert');
let Bitfinex = require('../../exchange/bitfinex');

let fs = require('fs');

describe('#bitfinex exchange implementation', function() {
    it('positions are extracted', () => {
        let pos = Bitfinex.createPositions(createResponse('on-ps.json'))

        assert.equal('IOTUSD', pos[0].symbol)
        assert.equal('short', pos[0].side)
        assert.equal(-80, pos[0].amount)

        assert.equal('IOTUSD', pos[1].symbol)
        assert.equal('long', pos[1].side)
        assert.equal(80, pos[1].amount)
        assert.equal(pos[1].updatedAt instanceof Date, true)
        assert.equal(pos[1].createdAt instanceof Date, true)
    })

    it('orders are extracted', () => {
        let orders = Bitfinex.createExchangeOrders(createResponse('on-orders.json'))

        assert.equal(orders[0].id, '18233985719')
        assert.equal(orders[0].symbol, 'BCHBTC')
        assert.equal(orders[0].status, 'open')

        assert.equal(orders[0].price, 0.067)
        assert.equal(orders[0].amount, 0.2)
        assert.equal(orders[0].retry, false)
        assert.equal(orders[0].ourId, '70300865307')
        assert.equal(orders[0].type, 'limit')
        assert.equal(orders[0].createdAt.toISOString(), '2018-10-19T19:31:40.939Z')
        assert.equal(orders[0].updatedAt instanceof Date, true)
    })

    var createResponse = function(filename) {
        return JSON.parse(fs.readFileSync(__dirname + '/bitfinex/' + filename, 'utf8'));
    }
});
