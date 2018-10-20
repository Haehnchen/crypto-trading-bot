let assert = require('assert');
let Bitmex = require('../../exchange/bitmex');

let fs = require('fs');

describe('#bitmex exchange implementation', function() {
    it('positions are extracted', () => {
        let pos = Bitmex.createPositions(createResponse('ws-positions.json'))

        assert.equal(pos[0].symbol, 'LTCZ18')
        assert.equal(pos[0].side, 'short')
        assert.equal(pos[0].amount, -4)
        assert.equal(pos[0].profit, 1.2)
        assert.equal(pos[0].entry, 0.00832)
    });

    it('orders are extracted', () => {
        let orders = Bitmex.createOrders(createResponse('ws-orders.json'))

        assert.equal(orders[0].id, 'fb7972c4-b4fa-080f-c0b1-1919db50bc63')
        assert.equal(orders[0].symbol, 'LTCZ18')
        assert.equal(orders[0].side, 'sell')
        assert.equal(orders[0].amount, 2)
        assert.equal(orders[0].price, 0.00839)
        assert.equal(orders[0].retry, false)
        assert.equal(orders[0].type, 'limit')
        assert.equal(orders[0].createdAt.toISOString(), '2018-10-19T16:31:27.496Z')
        assert.equal(orders[0].updatedAt instanceof Date, true)

        assert.equal(orders[2].price, 0.00852)
        assert.equal(orders[2].type, 'stop')
    });

    var createResponse = function(filename) {
        return JSON.parse(fs.readFileSync(__dirname + '/bitmex/' + filename, 'utf8'));
    }
});
