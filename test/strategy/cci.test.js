let assert = require('assert');
let CCI = require('../../strategy/cci');

let IndicatorBuilder = require('../../strategy/dict/indicator_builder');
let IndicatorPeriod = require('../../strategy/dict/indicator_period');

describe('#strategy cci', () => {
    it('strategy cci short', async () => {
        let indicatorBuilder = new IndicatorBuilder()
        let cci = new CCI()

        cci.buildIndicator(indicatorBuilder)

        assert.equal(3, indicatorBuilder.all().length)

        let indicatorPeriod = new IndicatorPeriod(394, {
            'sma200': [500, 400],
            'ema200': [500, 400],
            'cci': [80, 90, 100, 110, 130, 150, 180, 200, 220, 280, 220, 200, 180, 150, 130, 90],
        })

        let result = await cci.period(indicatorPeriod)

        assert.equal('short', result['signal'])
        assert.equal(280, result['_trigger'])
    });
});
