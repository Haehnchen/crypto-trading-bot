let assert = require('assert');
let Bitfinex = require('../../exchange/bitfinex');
let OurOrder = require('../../dict/order');
let ExchangeOrder = require('../../dict/exchange_order');
let Ticker = require('../../dict/ticker');
const { Position, Order } = require('bfx-api-node-models')

let fs = require('fs');

describe('#bitfinex exchange implementation', function() {
    it('positions are extracted', () => {
        let pos = Bitfinex.createPositions(createResponse('on-ps.json').map(r => {
            return Position.unserialize(r)
        }))

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

        assert.equal(orders[0].raw.status, 'ACTIVE')
    })

    it('test that symbol sizes are provided', async () => {
        let bitfinex = new Bitfinex(
            {},
            {
                'debug': () => {}
            },
            {
                'executeRequestRetry': async() => {
                    return {'body': JSON.stringify([
                        {"pair":"btcusd","price_precision":5,"initial_margin":"30.0","minimum_margin":"15.0","maximum_order_size":"2000.0","minimum_order_size":"0.004","expiration":"NA","margin":true},
                        {"pair":"ltcbtc","price_precision":2,"initial_margin":"30.0","minimum_margin":"15.0","maximum_order_size":"5000.0","minimum_order_size":"0.4","expiration":"NA","margin":true},
                    ])}
                },
            },
        )

        await bitfinex.syncSymbolDetails()

        assert.equal(bitfinex.calculateAmount(1234.44444, 'BTC'), 1234.444)
        assert.equal(bitfinex.calculateAmount(1234.444, 'LTC'), 1234.4439)
        assert.equal(bitfinex.calculateAmount(1234.444, 'FOOBAR'), 1234.444)
    })

    it('test that order options are created (short)', async () => {
        let actual = Bitfinex.createOrder(OurOrder.createLimitPostOnlyOrderAutoSide('BTCUSD', -1337.12, -10)).toPreview();
        delete actual['cid']

        assert.deepEqual(actual, {
            "amount": -10,
            "flags": 4096,
            "gid": undefined,
            "notify": undefined,
            "price": "1337.12",
            "symbol": "tBTCUSD",
            "type": "LIMIT",
        })
    })

    it('test that order options are created (long)', async () => {
        let actual = Bitfinex.createOrder(OurOrder.createLimitPostOnlyOrderAutoSide('BTCUSD', 1337.12, 10)).toPreview();
        delete actual['cid']

        assert.deepEqual(actual, {
            "amount": 10,
            "flags": 4096,
            "gid": undefined,
            "notify": undefined,
            "price": "1337.12",
            "symbol": "tBTCUSD",
            "type": "LIMIT",
        })
    })

    it('test that order options are created (stop long)', async () => {
        let actual = Bitfinex.createOrder(OurOrder.createStopLossOrder('BTCUSD', 1337.12, 10)).toPreview();
        delete actual['cid']

        assert.deepEqual(actual, {
            "amount": 10,
            "flags": 1024,
            "gid": undefined,
            "notify": undefined,
            "price": "1337.12",
            "symbol": "tBTCUSD",
            "type": "STOP",
        })
    })

    it('test that order options are created (stop short)', async () => {
        let actual = Bitfinex.createOrder(OurOrder.createStopLossOrder('BTCUSD', -1337.12, -10)).toPreview();
        delete actual['cid']

        assert.deepEqual(actual, {
            "amount": -10,
            "flags": 1024,
            "gid": undefined,
            "notify": undefined,
            "price": "1337.12",
            "symbol": "tBTCUSD",
            "type": "STOP",
        })
    })

    it('test that order options are created (market long)', async () => {
        let actual = Bitfinex.createOrder(OurOrder.createMarketOrder('BTCUSD', 10)).toPreview();
        delete actual['cid']

        assert.deepEqual(actual, {
            "amount": 10,
            "flags": 0,
            "gid": undefined,
            "notify": undefined,
            "price": undefined,
            "symbol": "tBTCUSD",
            "type": "MARKET",
        })
    })

    it('test that order options are created (market short)', async () => {
        let actual = Bitfinex.createOrder(OurOrder.createMarketOrder('BTCUSD', -10)).toPreview();
        delete actual['cid']

        assert.deepEqual(actual, {
            "amount": -10,
            "flags": 0,
            "gid": undefined,
            "notify": undefined,
            "price": undefined,
            "symbol": "tBTCUSD",
            "type": "MARKET",
        })
    })

    it('test that order options are created (stop loss short)', async () => {
        let actual = Bitfinex.createOrder(OurOrder.createStopLossOrder('BTCUSD', -10, -2)).toPreview();
        delete actual['cid']

        assert.deepEqual(actual, {
            "amount": -2,
            "flags": 1024,
            "gid": undefined,
            "notify": undefined,
            "price": "10",
            "symbol": "tBTCUSD",
            "type": "STOP",
        })
    })

    it('test that order options are created (stop loss long)', async () => {
        let actual = Bitfinex.createOrder(OurOrder.createStopLossOrder('BTCUSD', 10, 2)).toPreview();
        delete actual['cid']

        assert.deepEqual(actual, {
            "amount": 2,
            "flags": 1024,
            "gid": undefined,
            "notify": undefined,
            "price": "10",
            "symbol": "tBTCUSD",
            "type": "STOP",
        })
    })

    it('test position events (long)', async () => {
        let bitfinex = new Bitfinex()

        bitfinex.tickers['BTCUSD'] = new Ticker('foobar', 'BTCUSD', undefined, 13.12, 13.13)

        bitfinex.onPositionUpdate(Position.unserialize([
            'tBTCUSD',
            'ACTIVE',
            0.1,
            12.12,
        ]))

        bitfinex.onPositionUpdate(Position.unserialize([
            'tLTCUSD',
            'CLOSED',
            0.1,
            12.12,
        ]))

        let positions = await bitfinex.getPositions()

        assert.equal(positions.find(p => p.symbol === 'BTCUSD').symbol, 'BTCUSD')
        assert.equal(positions.find(p => p.symbol === 'BTCUSD').profit.toFixed(2), 8.25)
        assert.equal(positions.filter(p => p.symbol === 'LTCUSD').length, 0)
    })

    it('test position events (short)', async () => {
        let bitfinex = new Bitfinex()

        bitfinex.tickers['BTCUSD'] = new Ticker('foobar', 'BTCUSD', undefined, 13.12, 13.13)

        bitfinex.onPositionUpdate(Position.unserialize([
            'tBTCUSD',
            'ACTIVE',
            -0.1,
            12.12,
        ]))

        let positions = await bitfinex.getPositions()

        assert.equal(positions.find(p => p.symbol === 'BTCUSD').symbol, 'BTCUSD')
        assert.equal(positions.find(p => p.symbol === 'BTCUSD').profit.toFixed(2), -7.69)
        assert.equal(positions.filter(p => p.symbol === 'LTCUSD').length, 0)
    })

    it('test position events (closing)', async () => {
        let bitfinex = new Bitfinex()

        bitfinex.onPositionUpdate(Position.unserialize([
            'tBTCUSD',
            'ACTIVE',
            12.12
        ]))

        assert.equal(Object.keys(bitfinex.positions).includes('BTCUSD'), true)
        assert.equal((await bitfinex.getPositions()).filter(p => p.symbol === 'BTCUSD').length, 1)

        bitfinex.onPositionUpdate(Position.unserialize([
            'tBTCUSD',
            'CLOSED',
            12.12
        ]))

        assert.equal(Object.keys(bitfinex.positions).includes('BTCUSD'), false)
        assert.equal((await bitfinex.getPositions()).filter(p => p.symbol === 'BTCUSD').length, 0)
    })

    it('test full position events (closing)', async () => {
        let bitfinex = new Bitfinex()

        bitfinex.onPositions([
            Position.unserialize([
                'tBTCUSD',
                'ACTIVE',
                12.12
            ]),
            Position.unserialize([
                'tLTCUSD',
                'CLOSED',
                12.12
            ]),
        ])

        assert.deepEqual(Object.keys(bitfinex.positions), ['BTCUSD'])
        assert.equal((await bitfinex.getPositions()).filter(p => p.symbol === 'BTCUSD').length, 1)
        assert.equal((await bitfinex.getPositions()).filter(p => p.symbol === 'LTCUSD').length, 0)

        bitfinex.onPositionUpdate(Position.unserialize([
            'tBTCUSD',
            'CLOSED',
            12.12
        ]))

        assert.deepEqual(Object.keys(bitfinex.positions), [])
        assert.equal((await bitfinex.getPositions()).length, 0)
    })

    it('test order updates', async () => {
        let bitfinex = new Bitfinex(
            {},
            {'info': () => {}},
            {}
        )

        bitfinex.onOrderUpdate(Order.unserialize([
            999911111000,
            1,
            undefined,
            'tBTCUSD',
            undefined,
            undefined,
            undefined,
            undefined,
            'LIMIT',
            undefined,
            undefined,
            undefined,
            undefined,
            'ACTIVE',
        ]))

        assert.deepEqual(Object.keys(bitfinex.orders), ['999911111000'])
        assert.equal((await bitfinex.getOrders()).filter(p => p.symbol === 'BTCUSD').length, 1)

        bitfinex.onOrderUpdate(Order.unserialize([
            999911111000,
            1,
            undefined,
            'tBTCUSD',
            undefined,
            undefined,
            undefined,
            undefined,
            'LIMIT',
            undefined,
            undefined,
            undefined,
            undefined,
            'EXECUTED',
        ]))

        assert.deepEqual(Object.keys(bitfinex.orders), ['999911111000'])
        assert.equal((await bitfinex.getOrders()).filter(p => p.symbol === 'BTCUSD').length, 0)
    })

    it('test that order is updated', async () => {
        let fixturesOrders = Bitfinex.createExchangeOrders(createResponse('on-orders.json'))

        let bitfinex = new Bitfinex()

        let myChanges
        bitfinex.client = {
            'updateOrder': async changes => {
                myChanges = changes
                return fixturesOrders[0]
            },
        }

        let exchangeOrder = await bitfinex.updateOrder(12345, OurOrder.createPriceUpdateOrder(121212, 12))

        assert.strictEqual(exchangeOrder.symbol, 'BCHBTC')
        assert.deepStrictEqual(myChanges, {'id': 12345, 'price': '12'})
    })

    it('test that order is updated for short must give positive price', async () => {
        let fixturesOrders = Bitfinex.createExchangeOrders(createResponse('on-orders.json'))

        let bitfinex = new Bitfinex()

        let myChanges
        bitfinex.client = {
            'updateOrder': async changes => {
                myChanges = changes
                return fixturesOrders[0]
            },
        }

        let exchangeOrder = await bitfinex.updateOrder(12345, OurOrder.createPriceUpdateOrder(121212, -12))

        assert.strictEqual(exchangeOrder.symbol, 'BCHBTC')
        assert.deepStrictEqual(myChanges, {'id': 12345, 'price': '12'})
    })

    it('test orders are canceled', async () => {
        let bitfinex = new Bitfinex()

        bitfinex.orders = {
            25035356: new ExchangeOrder(25035356, 'FOOUSD', 'open', undefined, undefined, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT),
            55555: new ExchangeOrder('55555', 'FOOUSD', 'open', undefined, undefined, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT),
        };

        let cancelIds = []
        bitfinex.client = {
            'cancelOrder': async id => {
                cancelIds.push(id)
                return undefined;
            },
        }

        let exchangeOrder = await bitfinex.cancelAll('FOOUSD')

        assert.strictEqual(exchangeOrder.find(o => o.id == 25035356).id, 25035356)
        assert.strictEqual(exchangeOrder.find(o => o.id == 55555).id, '55555')

        assert.strictEqual(Object.keys(bitfinex.orders).length, 0)

        assert.strictEqual(cancelIds.includes(25035356), true)
        assert.strictEqual(cancelIds.includes(55555), true)
    })

    it('test orders that a single order can be canceled', async () => {
        let bitfinex = new Bitfinex()

        bitfinex.orders = {
            25035356: new ExchangeOrder(25035356, 'FOOUSD', 'open', undefined, undefined, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT),
            55555: new ExchangeOrder(55555, 'FOOUSD', 'open', undefined, undefined, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT),
        };

        let cancelIds = []
        bitfinex.client = {
            'cancelOrder': async id => {
                cancelIds.push(id)
                return undefined;
            },
        }

        await bitfinex.cancelOrder(55555)
        assert.strictEqual(cancelIds.includes(55555), true)

        await bitfinex.cancelOrder('25035356')
        assert.strictEqual(cancelIds.includes(25035356), true)
    })

    let createResponse = function(filename) {
        return JSON.parse(fs.readFileSync(__dirname + '/bitfinex/' + filename, 'utf8')).map(item => {
            item['_fieldKeys'] = ['status'] // fake magic object of lib
            return item
        });
    }
});
