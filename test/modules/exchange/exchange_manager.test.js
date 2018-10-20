let assert = require('assert');
let ExchangeManager = require('../../../modules/exchange/exchange_manager');
let fs = require('fs');

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

        let exchangeManager = new ExchangeManager({}, {}, {'symbols': symbols}, {'exchanges': config})

        exchangeManager.init()

        assert.deepEqual(
            exchangeManager.all().map(exchange => exchange.getName()).sort(),
            [ 'noop']
        )

        assert.equal(exchangeManager.get('noop').getName(), 'noop')
        assert.equal(exchangeManager.get('UNKNOWN'), undefined)
    })
})
