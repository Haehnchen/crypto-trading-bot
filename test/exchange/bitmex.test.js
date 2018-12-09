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

        assert.equal(pos[0].createdAt.toISOString(), '2018-10-19T17:00:00.000Z')
    })

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
        assert.equal(orders[0].retry, false)
        assert.equal(orders[0].status, 'open')

        assert.equal(orders[2].price, 0.00852)
        assert.equal(orders[2].type, 'stop')
        assert.equal(orders[2].retry, false)

        assert.equal(orders[4].retry, false)
        assert.equal(orders[4].status, 'done')
    })

    it('orders retry trigger', () => {
        let orders = Bitmex.createOrders(createResponse('ws-orders.json'))

        assert.equal(orders[3].retry, true)
        assert.equal(orders[3].status, 'canceled')
    })

    it('calculate instrument rounding sizes', () => {
        let bitmex = new Bitmex()

        bitmex.lotSizes = {
            'LTC': 1,
        }

        bitmex.tickSizes = {
            'LTC': 0.00001,
        }

        assert.equal(bitmex.calculatePrice(0.0085696, 'LTC'), 0.00857)
        assert.equal(bitmex.calculateAmount(0.85, 'LTC'), 1)

        assert.equal(bitmex.calculatePrice(-0.0085696, 'LTC'), -0.00857)
        assert.equal(bitmex.calculateAmount(-0.85, 'LTC'), -1)
    })

    var createResponse = function(filename) {
        return JSON.parse(fs.readFileSync(__dirname + '/bitmex/' + filename, 'utf8'));
    }
})
