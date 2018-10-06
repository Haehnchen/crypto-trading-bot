let assert = require('assert');
let CCI = require('../../strategy/cci');
let IndicatorBuilder = require('../../strategy/dict/indicator_builder')
let IndicatorPeriod = require('../../strategy/dict/indicator_period')

describe('#strategy cci', () => {
    it('cci indicator builder', async () => {
        let indicatorBuilder = new IndicatorBuilder()
        let macd = new CCI()

        macd.buildIndicator(indicatorBuilder, {'period': '15m'})
        assert.equal(3, indicatorBuilder.all().length)
    });

    it('strategy cci short', async () => {
        let cci = new CCI()

        let result = await cci.period(new IndicatorPeriod(394, {
            'sma200': [500, 400],
            'ema200': [500, 400],
            'cci': [80, 90, 100, 110, 130, 150, 180, 200, 220, 280, 220, 200, 180, 150, 130, 90],
        }))

        assert.equal('short', result['signal'])
        assert.equal(280, result['_trigger'])

        let result2 = await cci.period(new IndicatorPeriod(394, {
            'sma200': [500, 400],
            'ema200': [500, 400],
            'cci': [80, 90, 100, 110, 130, 150, 180, 190, 199, 180, 150, 130, 90],
        }))

        assert.equal(undefined, result2['signal'])
    });

    it('strategy cci long', async () => {
        let cci = new CCI()

        let result = await cci.period(new IndicatorPeriod(404, {
            'sma200': [500, 400],
            'ema200': [500, 400],
            'cci': [-80, -90, -100, -110, -130, -150, -180, -200, -220, -280, -220, -200, -180, -150, -130, -90],
        }))

        assert.equal('long', result['signal'])
        assert.equal(-280, result['_trigger'])

        let result2 = await cci.period(new IndicatorPeriod(404, {
            'sma200': [500, 400],
            'ema200': [500, 400],
            'cci': [-80, -90, -100, -110, -130, -150, -180, -190, -199, -180, -150, -130, -90],
        }))

        assert.equal(undefined, result2['signal'])

        let result3 = await cci.period(new IndicatorPeriod(404, {
            'sma200': [900, 900],
            'ema200': [500, 400],
            'cci': [-80, -90, -100, -110, -130, -150, -180, -200, -220, -280, -220, -200, -180, -150, -130, -90],
        }))

        assert.equal('long', result3['signal'])
        assert.equal(-280, result3['_trigger'])
    });
});
