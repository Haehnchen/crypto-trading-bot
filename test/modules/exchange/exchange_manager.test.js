let assert = require('assert');
let ExchangeManager = require('../../../modules/exchange/exchange_manager');
let Noop = require('../../../exchange/noop');
let Position = require('../../../dict/position');
let ExchangeOrder = require('../../../dict/exchange_order');

describe('#exchange manager', () => {
    it('test that exchanges are initialized', () => {
        let symbols = [
            {
                'symbol': 'BTCUSD',
                'periods': ['1m', '15m', '1h'],
                'exchange': 'noop',
                'state': 'watch'
            },
            {
                'symbol': 'BTCUSD',
                'periods': ['1m', '15m', '1h'],
                'exchange': 'FOOBAR',
                'state': 'watch'
            }
        ]

        let config = {
            "noop": {
                "key": "foobar",
                "secret": "foobar"
            },
        }

        let exchangeManager = new ExchangeManager([new Noop()], {}, {'symbols': symbols}, {'exchanges': config})

        exchangeManager.init()

        assert.deepEqual(
            exchangeManager.all().map(exchange => exchange.getName()).sort(),
            [ 'noop']
        )

        assert.equal(exchangeManager.get('noop').getName(), 'noop')
        assert.equal(exchangeManager.get('UNKNOWN'), undefined)
    })

    it('test positions and orders', async () => {
        let symbols = [
            {
                'symbol': 'BTCUSD',
                'periods': ['1m', '15m', '1h'],
                'exchange': 'noop',
                'state': 'watch'
            },
        ]

        let config = {
            "noop": {
                "key": "foobar",
                "secret": "foobar"
            },
        }

        let exchange = new Noop()
        exchange.getPositionForSymbol = async symbol => new Position(symbol, 'long', 1, undefined, undefined, 100, {'stop': 0.9})
        exchange.getPositions = async() => [new Position('BTCUSDT', 'long', 1, undefined, undefined, 100, {'stop': 0.9})]
        exchange.getOrdersForSymbol = async symbol => new ExchangeOrder('25035356', symbol, 'open', undefined, undefined, undefined, undefined, 'buy')

        let exchangeManager = new ExchangeManager(
            [exchange],
            {},
            {'symbols': symbols},
            {'exchanges': config}
        );

        exchangeManager.init()

        let position = await exchangeManager.getPosition('noop', 'BTCUSD');
        assert.strictEqual(position.symbol,'BTCUSD')

        let order = await exchangeManager.getOrders('noop', 'BTCUSD');
        assert.strictEqual(order.symbol,'BTCUSD')

        let positions = await exchangeManager.getPositions('noop', 'BTCUSD');
        assert.strictEqual(positions[0].getExchange(),'noop')
        assert.strictEqual(positions[0].getSymbol(),'BTCUSDT')
        assert.strictEqual(positions[0].getPosition().symbol,'BTCUSDT')
    })
})
