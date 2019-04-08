let assert = require('assert')
let OrderCalculator = require('../../../modules/order/order_calculator')

describe('#order size calculation', () => {
    it('test instance order size for capital', async () => {

        let instances = {}

        instances.symbols = [
            {
                'exchange': 'foobar',
                'symbol': 'foo',
                'trade': {
                    'capital': 12,
                }
            },
            {
                'exchange': 'foobar2',
                'symbol': 'foo2',
            },
            {
                'exchange': 'foobar',
                'symbol': 'foo2',
                'trade': {
                    'capital': 1337,
                }
            },
        ]

        let calculator = new OrderCalculator(
            instances,
            {},
            {},
            {'get': () => { return {'calculateAmount': (n) => n}}}
        );

        assert.equal(await calculator.calculateOrderSize('foobar', 'foo'), 12)
        assert.equal(await calculator.calculateOrderSize('UNKNOWN', 'foo'), undefined)
        assert.equal(await calculator.calculateOrderSize('foobar', 'foo2'), 1337)
    })

    it('test instance order size currency capital', async () => {

        let instances = {}

        instances.symbols = [
            {
                'exchange': 'foobar',
                'symbol': 'foo',
                'trade': {
                    'currency_capital': 12,
                }
            },
            {
                'exchange': 'foobar2',
                'symbol': 'foo2',
            },
            {
                'exchange': 'foobar',
                'symbol': 'foo2',
                'trade': {
                    'currency_capital': 1337,
                }
            },
        ]

        let calculator = new OrderCalculator(
            instances,
            {'get': (exchangeName, symbol) => {
                    if (symbol === 'foo') {
                        return {'bid': 3000}
                    }

                    if (symbol === 'foo2') {
                        return {'bid': 6000}
                    }
                }},
            {},
            {'get': () => { return {'calculateAmount': (n) => n}}}
        )

        assert.equal(await calculator.calculateOrderSize('foobar', 'foo'), 0.004)
        assert.equal(await calculator.calculateOrderSize('UNKNOWN', 'foo'), undefined)
        assert.equal((await calculator.calculateOrderSize('foobar', 'foo2')).toFixed(2), 0.22)
    })
})
