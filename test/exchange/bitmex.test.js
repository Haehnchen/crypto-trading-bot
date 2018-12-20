let assert = require('assert');
let Bitmex = require('../../exchange/bitmex');
let Order = require('../../dict/order');

let fs = require('fs');

describe('#bitmex exchange implementation', function() {
    it('positions are extracted', () => {
        let pos = Bitmex.createPositionsWithOpenStateOnly(createResponse('ws-positions.json'))

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

    it('test that request body for limit order to close is generated', () => {
        let body = Bitmex.createOrderBody(Order.createCloseOrderWithPriceAdjustment('BTCUSD', -1337))
        body['clOrdID'] = 'foobar'

        assert.equal(body['execInst'], 'ReduceOnly,ParticipateDoNotInitiate')
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

    it('test that overload response must provide a retry', () => {
        let order = Bitmex.resolveOrderResponse(
            {'error': () => {}},
            undefined,
            undefined,
            JSON.stringify({'error': {
                    'message': 'The system is currently overloaded. Please try again later.',
                }}),
            Order.createMarketOrder('BTCUSD', 12)
        )

        assert.equal(order.retry, true)
        assert.equal(order.status, 'canceled')
    })

    it('test that unknown request must provide a error', () => {
        let order = Bitmex.resolveOrderResponse(
            {'error': () => {}},
            undefined,
            undefined,
            JSON.stringify({'error': {}}),
            Order.createMarketOrder('BTCUSD', 12)
        )

        assert.equal(order, undefined)
    })

    it('test that order response is provide', () => {
        let order = Bitmex.resolveOrderResponse(
            {'error': () => {}, 'info': () => {}},
            undefined,
            undefined,
            JSON.stringify(createResponse('ws-orders.json')[0]),
            Order.createMarketOrder('BTCUSD', 12)
        )

        assert.equal(order.type, 'limit')
        assert.equal(order.side, 'sell')
    })

    it('test position updates with workflow', async () => {
        let bitmex = new Bitmex(undefined, undefined)

        let positions = createResponse('ws-positions-updates.json');

        // init positions
        bitmex.fullPositionsUpdate(positions)
        assert.equal((await bitmex.getPositions()).length, 2)
        assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD')
        assert.equal((await bitmex.getPositionForSymbol('LTCZ18')).symbol, 'LTCZ18')
        assert.equal((await bitmex.getPositionForSymbol('FOOUSD')), undefined)

        // remove one item
        bitmex.fullPositionsUpdate(positions.slice().filter(position => position.symbol !== 'LTCZ18'))
        assert.equal((await bitmex.getPositions()).length, 1)
        assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD')
        assert.equal((await bitmex.getPositionForSymbol('LTCZ18')), undefined)
        assert.equal((await bitmex.getPositionForSymbol('FOOUSD')), undefined)

        // full update again
        bitmex.fullPositionsUpdate(positions)
        assert.equal((await bitmex.getPositions()).length, 2)

        // set LTCZ18 TO be closed; previous state was open
        let positions1 = positions.slice()
        positions1[0].isOpen = false

        bitmex.fullPositionsUpdate(positions1)
        assert.equal((await bitmex.getPositions()).length, 1)
        assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD')
        assert.equal((await bitmex.getPositionForSymbol('LTCZ18')), undefined)
        assert.equal((await bitmex.getPositionForSymbol('FOOUSD')), undefined)
    })

    it('test position updates with delta workflow', async () => {
        let bitmex = new Bitmex(undefined, undefined)

        let positions = createResponse('ws-positions-updates.json');

        // init positions
        bitmex.deltaPositionsUpdate(positions)
        assert.equal((await bitmex.getPositions()).length, 2)
        assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD')
        assert.equal((await bitmex.getPositionForSymbol('LTCZ18')).symbol, 'LTCZ18')
        assert.equal((await bitmex.getPositionForSymbol('FOOUSD')), undefined)

        // remove one item; but must not be cleared
        bitmex.deltaPositionsUpdate(positions.slice().filter(position => position.symbol !== 'LTCZ18'))
        assert.equal((await bitmex.getPositions()).length, 2)
        assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD')
        assert.equal((await bitmex.getPositionForSymbol('LTCZ18')).symbol, 'LTCZ18')
        assert.equal((await bitmex.getPositionForSymbol('FOOUSD')), undefined)

        // set LTCZ18 TO be closed; previous state was open
        let positions1 = positions.slice()
        positions1[0].isOpen = false

        bitmex.fullPositionsUpdate(positions1)
        assert.equal((await bitmex.getPositions()).length, 1)
        assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD')
        assert.equal((await bitmex.getPositionForSymbol('LTCZ18')), undefined)
        assert.equal((await bitmex.getPositionForSymbol('FOOUSD')), undefined)
    })

    it('test update of order', async () => {
        let bitmex = new Bitmex(undefined, {'info': () => {}})

        bitmex.apiKey = 'my_key'
        bitmex.apiSecret = 'my_secret'
        bitmex.retryOverloadMs = 10

        let myOptions = undefined

        bitmex.requestClient = {
            'executeRequest': (options) => {
                return new Promise((resolve) => {
                    myOptions = options

                    resolve({
                        'error': undefined,
                        'response': undefined,
                        'body': JSON.stringify(createResponse('ws-orders.json')[0]),
                    })
                })
            }
        }

        let order = await bitmex.updateOrder('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar'))

        assert.equal(myOptions.method, 'PUT')
        assert.equal(myOptions.body, '{"orderID":"0815foobar","text":"Powered by your awesome crypto-bot watchdog","price":null}')
        assert.equal(myOptions.url, 'https://www.bitmex.com/api/v1/order')

        assert.equal(Object.keys(myOptions.headers).includes('api-expires'), true)
        assert.equal(Object.keys(myOptions.headers).includes('api-key'), true)
        assert.equal(Object.keys(myOptions.headers).includes('api-signature'), true)

        assert.equal(order.id, 'fb7972c4-b4fa-080f-c0b1-1919db50bc63')
        assert.equal(order.retry, false)
    })

    it('test update of order with retry', async () => {
        let bitmex = new Bitmex(undefined, {'info': () => {}, 'error': () => {}})

        bitmex.apiKey = 'my_key'
        bitmex.apiSecret = 'my_secret'
        bitmex.retryOverloadMs = 10

        let responses = []

        for (let retry = 0; retry < 2; retry++) {
            responses.push({
                'error': undefined,
                'response': undefined,
                'body': JSON.stringify({'error': {
                        'message': 'The system is currently overloaded. Please try again later.',
                    }}),
            })
            responses.push({
                'error': undefined,
                'response': {'statusCode': 503},
                'body': undefined,
            })
        }

        responses.push({
            'error': undefined,
            'response': undefined,
            'body': JSON.stringify(createResponse('ws-orders.json')[0]),
        })

        let i = 0

        bitmex.requestClient = {
            'executeRequest': () => {
                return new Promise((resolve) => {
                    resolve(responses[i++])
                })
            }
        }

        let order = await bitmex.updateOrder('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar'))

        assert.equal(order.id, 'fb7972c4-b4fa-080f-c0b1-1919db50bc63')
        assert.equal(order.retry, false)
    })

    it('test update of order with retry limit reached', async () => {
        let bitmex = new Bitmex(undefined, {'info': () => {}, 'error': () => {}})

        bitmex.apiKey = 'my_key'
        bitmex.apiSecret = 'my_secret'
        bitmex.retryOverloadMs = 10

        let responses = []

        for (let retry = 0; retry < 10; retry++) {
            responses.push({
                'error': undefined,
                'response': undefined,
                'body': JSON.stringify({'error': {
                        'message': 'The system is currently overloaded. Please try again later.',
                    }}),
            })
        }

        let i = 0

        bitmex.requestClient = {
            'executeRequest': () => {
                return new Promise((resolve) => {
                    resolve(responses[i++])
                })
            }
        }

        let err = 'foobar'
        try {
            await bitmex.updateOrder('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar'))
        } catch (e) {
            err = e
        }

        assert.equal(err, undefined)
    })

    it('test update of order with retry limit reached with status code 503', async () => {
        let bitmex = new Bitmex(undefined, {'info': () => {}, 'error': () => {}})

        bitmex.apiKey = 'my_key'
        bitmex.apiSecret = 'my_secret'
        bitmex.retryOverloadMs = 10

        let responses = []

        for (let retry = 0; retry < 10; retry++) {
            responses.push({
                'error': undefined,
                'response': {'statusCode': 503},
                'body': undefined,
            })
        }

        let i = 0

        bitmex.requestClient = {
            'executeRequest': () => {
                return new Promise((resolve) => {
                    resolve(responses[i++])
                })
            }
        }

        let err = 'foobar'
        try {
            await bitmex.updateOrder('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar'))
        } catch (e) {
            err = e
        }

        assert.equal(err, undefined)
    })

    let createResponse = (filename) => {
        return JSON.parse(fs.readFileSync(__dirname + '/bitmex/' + filename, 'utf8'));
    }
})
