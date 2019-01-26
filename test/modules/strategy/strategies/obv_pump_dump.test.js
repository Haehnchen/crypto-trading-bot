let assert = require('assert')
let OBVPumpDump = require('../../../../modules/strategy/strategies/obv_pump_dump')
let IndicatorBuilder = require('../../../../modules/strategy/dict/indicator_builder')
let IndicatorPeriod = require('../../../../modules/strategy/dict/indicator_period')
let StrategyContext = require('../../../../dict/strategy_context')
let Ticker = require('../../../../dict/ticker')

describe('#strategy obv_pump_dump', () => {
    it('obv_pump_dump strategy builder', async() => {
        let indicatorBuilder = new IndicatorBuilder()
        let obv = new OBVPumpDump()

        obv.buildIndicator(indicatorBuilder)
        assert.equal(2, indicatorBuilder.all().length)
    });

    it('obv_pump_dump strategy long', async() => {
        let obv = new OBVPumpDump()

        let result = await obv.period(new IndicatorPeriod(createStrategyContext(), {
            'ema': [380, 370],
            'obv': [-2358, -2395, -2395, -2395, -2385, -2165, -1987, -1987, -1990, -1990, -1990, -1990, -1990, -1948, -1808, -1601, -1394, -1394, -1147, 988, 3627, 6607, 11467],
        }), {})

        assert.equal('long', result.getSignal())
        assert.equal('up', result.getDebug()['trend'])
    })

    it('obv_pump_dump strategy long options', async() => {
        let obv = new OBVPumpDump()

        let result = await obv.period(new IndicatorPeriod(createStrategyContext(), {
            'ema': [380, 370],
            'obv': [-2358, -2395, -2395, -2395, -2385, -2165, -1987, -1987, -1990, -1990, -1990, -1990, -1990, -1948, -1808, -1601, -1394, -1394, -1147, 988, 3627, 6607, 11467],
        }), {'trigger_multiplier': 1000})

        assert.equal(undefined, result.getSignal())
        assert.equal('up', result.getDebug()['trend'])
    })

    let createStrategyContext = () => {
        return new StrategyContext(new Ticker('goo', 'goo', 'goo', 394, 394))
    }
})
