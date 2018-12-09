let assert = require('assert')
let OrderCalculator = require('../../../modules/order/order_calculator')

describe('#order size calculation', function() {
    it('test instance order size', () => {

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

        let calculator = new OrderCalculator(instances);

        assert.equal(calculator.calculateOrderSize('foobar', 'foo'), 12)
        assert.equal(calculator.calculateOrderSize('UNKNOWN', 'foo'), undefined)
        assert.equal(calculator.calculateOrderSize('foobar', 'foo2'), 1337)
    })
})
