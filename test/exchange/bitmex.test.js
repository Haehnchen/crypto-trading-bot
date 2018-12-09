let assert = require('assert');
let Bitmex = require('../../exchange/bitmex');
let Order = require('../../dict/order');

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

    it('test that request body for order is created (limit order)', () => {
        let body = Bitmex.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'long', 1337, 0.5))
        body['clOrdID'] = 'foobar'

        assert.deepEqual(body, {
            symbol: 'BTCUSD',
            orderQty: 0.5,
            ordType: 'Limit',
            text: 'Powered by your awesome crypto-bot watchdog',
            execInst: 'ParticipateDoNotInitiate',
            price: 1337,
            side: 'Buy',
            clOrdID: 'foobar',
        })
    })

    it('test that request body for order is created (limit order) [short]', () => {
        let body = Bitmex.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'short', -1337, 0.5))
        body['clOrdID'] = 'foobar'

        assert.deepEqual(body, {
            symbol: 'BTCUSD',
            orderQty: 0.5,
            ordType: 'Limit',
            text: 'Powered by your awesome crypto-bot watchdog',
            execInst: 'ParticipateDoNotInitiate',
            price: 1337,
            side: 'Sell',
            clOrdID: 'foobar'
        })
    })

    it('test that request body for order is created (stop order)', () => {
        let body = Bitmex.createOrderBody(Order.createStopLossOrder('BTCUSD', 1337, 0.5))
        body['clOrdID'] = 'foobar'

        assert.deepEqual(body, {
            symbol: 'BTCUSD',
            orderQty: 0.5,
            ordType: 'Stop',
            text: 'Powered by your awesome crypto-bot watchdog',
            execInst: 'Close,LastPrice',
            stopPx: 1337,
            side: 'Buy',
            clOrdID: 'foobar',
        })
    })

    it('test that request body for order is created (stop order) [short]', () => {
        let body = Bitmex.createOrderBody(Order.createStopLossOrder('BTCUSD', -1337, 0.5))
        body['clOrdID'] = 'foobar'

        assert.deepEqual(body, {
            symbol: 'BTCUSD',
            orderQty: 0.5,
            ordType: 'Stop',
            text: 'Powered by your awesome crypto-bot watchdog',
            execInst: 'Close,LastPrice',
            stopPx: 1337,
            side: 'Sell',
            clOrdID: 'foobar',
        })
    })

    var createResponse = function(filename) {
        return JSON.parse(fs.readFileSync(__dirname + '/bitmex/' + filename, 'utf8'));
    }
})
