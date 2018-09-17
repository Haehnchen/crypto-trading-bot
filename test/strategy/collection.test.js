let assert = require('assert');
let strategy = require('../../strategy/collection');

describe('#strategy collection', () => {
    it('strategy cci short', async () => {
        const result = await strategy.cci(
            [64, 66],
            [78, 80],
            [280, 220, 200, 180]
        )

        assert.equal('short', result['signal'])

        const result2 = await strategy.cci(
            [64, 66],
            [78, 80],
            [180, 320, 100, 180]
        )

        assert.equal(undefined, result2)
    });

    it('strategy cci long', async () => {
        const result = await strategy.cci(
            [78, 80],
            [64, 66],
            [-220, -180]
        )

        assert.equal('long', result['signal'])

        const result2 = await strategy.cci(
            [78, 80],
            [64, 66],
            [-160, -180]
        )

        assert.equal(undefined, result2)
    });

    it('strategy macd long', async () => {
        const result = await strategy.macd(
            404,
            [500, 400],
            [{'histogram': -1}, {'histogram': 0.1}]
        )

        assert.equal('long', result['signal'])

        assert.equal(undefined, await strategy.macd(
            360,
            [500, 400],
            [{'histogram': -1}, {'histogram': 0.1}]
        ))

        assert.equal(undefined, await strategy.macd(
            404,
            [500, 400],
            [{'histogram': -2}, {'histogram': -1}]
        ))

        assert.equal(undefined, await strategy.macd(
            404,
            [500, 400],
            [{'histogram': 2}, {'histogram': -1}]
        ))
    });

    it('strategy macd short', async () => {
        const result = await strategy.macd(
            394,
            [500, 400],
            [{'histogram': 1}, {'histogram': -0.1}]
        )

        assert.equal('short', result['signal'])

        assert.equal(undefined, await strategy.macd(
            403,
            [500, 400],
            [{'histogram': 1}, {'histogram': -0.1}]
        ))
    });
});
