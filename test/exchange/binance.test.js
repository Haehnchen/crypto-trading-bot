let assert = require('assert');
let Binance = require('../../exchange/binance');
let Order = require('../../dict/order');
let Position = require('../../dict/position');
let Ticker = require('../../dict/ticker');

let fs = require('fs');

describe('#binance exchange implementation', function() {
    it('limit order is created', () => {
        let orders = Binance.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'long', 1337, 0.5))

        delete orders['newClientOrderId']

        assert.deepEqual(
            {
                'symbol': 'BTCUSD',
                'quantity': 0.5,
                'side': 'BUY',
                'price': 1337,
                'type': 'LIMIT'
            },
            orders
        )
    })

    it('market order is created', () => {
        let orders = Binance.createOrderBody(Order.createMarketOrder('BTCUSD', -1337))

        delete orders['newClientOrderId']

        assert.deepEqual(
            {
                'quantity': 1337,
                'side': 'SELL',
                'symbol': 'BTCUSD',
                'type': 'MARKET',
            },
            orders
        )
    })

    it('stop order is created', () => {
        let orders = Binance.createOrderBody(Order.createStopLossOrder('BTCUSD', -1337 , 12))

        delete orders['newClientOrderId']

        assert.deepEqual(
            {
                'stopPrice': 1337,
                'quantity': 12,
                'side': 'SELL',
                'symbol': 'BTCUSD',
                'type': 'STOP_LOSS',
            },
            orders
        )
    })

    it('order creation', async () => {
        let binance = new Binance()
        binance.client = {
            'order': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'XLMETH',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e',
                    transactTime: 1514418413947,
                    price: '0.00020000',
                    origQty: '100.10000000',
                    executedQty: '0.00000000',
                    status: 'NEW',
                    timeInForce: 'GTC',
                    type: 'LIMIT',
                    side: 'BUY'
                })
            }) }
        }

        assert.equal(0, (await binance.getOrders()).length)

        let order = await binance.order(Order.createStopLossOrder('BTCUSD', -1337 , 12))

        assert.equal(1740797, order.id)
        assert.equal('XLMETH', order.symbol)
        assert.equal('open', order.status)
        assert.equal('0.00020000', order.price)
        assert.equal(100.1, order.amount)
        assert.equal(false, order.retry)
        assert.equal('1XZTVBTGS4K1e', order.ourId)
        assert.equal('buy', order.side)
        assert.equal('limit', order.type)
        assert.equal('0.00000000', order.raw['executedQty'])

        assert.equal(1, (await binance.getOrders()).length)
        assert.equal(1, (await binance.getOrdersForSymbol('XLMETH')).length)
        assert.equal(0, (await binance.getOrdersForSymbol('FOOBAR')).length)

        assert.equal('1XZTVBTGS4K1e', (await binance.findOrderById(1740797)).ourId)
    })

    it('order creation cases', async () => {
        let binance = new Binance()
        binance.client = {
            'order': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'XLMETH',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e',
                    transactTime: 1514418413947,
                    price: '0.00020000',
                    origQty: '100.10000000',
                    executedQty: '0.00000000',
                    status: 'PARTIALLY_FILLED',
                    timeInForce: 'GTC',
                    type: 'STOP_LOSS',
                    side: 'SELL'
                })
            }) }
        }

        let order = await binance.order(Order.createStopLossOrder('BTCUSD', -1337 , 12))

        assert.equal('open', order.status)
        assert.equal('sell', order.side)
        assert.equal('stop', order.type)
        assert.equal(true, order.createdAt instanceof Date)
        assert.equal(true, order.updatedAt instanceof Date)
    })

    it('order cancel order', async () => {
        let binance = new Binance()
        binance.client = {
            'order': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'BTCUSD',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e',
                    transactTime: 1514418413947,
                    price: '0.00020000',
                    origQty: '100.10000000',
                    executedQty: '0.00000000',
                    status: 'PARTIALLY_FILLED',
                    timeInForce: 'GTC',
                    type: 'STOP_LOSS',
                    side: 'SELL'
                })
            }) },
            'cancelOrder': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'BTCUSD',
                    origClientOrderId: '1XZTVBTGS4K1e',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e'
                })
            }) }
        }

        await binance.order(Order.createStopLossOrder('BTCUSD', -1337 , 12))
        assert.equal(1, (await binance.getOrders()).length)
        assert.equal(1, (await binance.getOrdersForSymbol('BTCUSD')).length)

        let order = await binance.cancelOrder(1740797)

        assert.equal(1740797, order.id)
        assert.equal('canceled', order.status)
    })

    it('order cancelAll orders', async () => {
        let binance = new Binance()
        binance.client = {
            'order': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'BTCUSD',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e',
                    transactTime: 1514418413947,
                    price: '0.00020000',
                    origQty: '100.10000000',
                    executedQty: '0.00000000',
                    status: 'PARTIALLY_FILLED',
                    timeInForce: 'GTC',
                    type: 'STOP_LOSS',
                    side: 'SELL'
                })
            }) },
            'cancelOrder': () => { return new Promise(resolve => {
                resolve({
                    symbol: 'BTCUSD',
                    origClientOrderId: '1XZTVBTGS4K1e',
                    orderId: 1740797,
                    clientOrderId: '1XZTVBTGS4K1e'
                })
            }) }
        }

        await binance.order(Order.createStopLossOrder('BTCUSD', -1337 , 12))
        assert.equal(1, (await binance.getOrders()).length)
        assert.equal(1, (await binance.getOrdersForSymbol('BTCUSD')).length)

        let orders = await binance.cancelAll('BTCUSD')

        assert.equal('canceled', orders[0].status)

        assert.equal(0, (await binance.getOrders()).length)
        assert.equal(0, (await binance.getOrdersForSymbol('BTCUSD')).length)
    })

    it('positions with profit', async () => {
        let binance = new Binance()

        binance.positions.push(new Position('BTCUSD', 'long', 12, undefined, undefined, 12))
        binance.tickers['BTCUSD'] = new Ticker('foobar', 'BTCUSD', undefined, 14, 18)

        let position = await binance.getPositionForSymbol('BTCUSD')

        assert.equal(Math.trunc(position.profit), 16)
    })
})
