let assert = require('assert')
let MACD = require('../../strategy/macd')

let IndicatorBuilder = require('../../strategy/dict/indicator_builder')
let IndicatorPeriod = require('../../strategy/dict/indicator_period')

describe('#strategy macd', () => {
    it('macd long', async () => {
        let indicatorBuilder = new IndicatorBuilder()
        let macd = new MACD()

        macd.buildIndicator(indicatorBuilder)

        assert.equal(3, indicatorBuilder.all().length)

        let indicatorPeriod = new IndicatorPeriod(404, {
            'sma200': [500, 400],
            'ema200': [500, 400],
            'macd': [{'histogram': -1}, {'histogram': 0.1}],
        })

        let result = await macd.period(indicatorPeriod)

        assert.equal('long', result['signal'])
    });
});
