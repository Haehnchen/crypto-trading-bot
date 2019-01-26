let assert = require('assert');
let CCI = require('../../../../modules/strategy/strategies/cci');
let IndicatorBuilder = require('../../../../modules/strategy/dict/indicator_builder')
let IndicatorPeriod = require('../../../../modules/strategy/dict/indicator_period')
let StrategyContext = require('../../../../dict/strategy_context')
let Ticker = require('../../../../dict/ticker')

describe('#strategy cci', () => {
    it('cci indicator builder', async () => {
        let indicatorBuilder = new IndicatorBuilder()
        let macd = new CCI()

        macd.buildIndicator(indicatorBuilder, {'period': '15m'})
        assert.equal(3, indicatorBuilder.all().length)
    });

    it('strategy cci short', async () => {
        let cci = new CCI()

        let result = await cci.period(new IndicatorPeriod(createStrategyContext(394), {
            'sma200': [500, 400, 300],
            'ema200': [500, 400, 300],
            'cci': [90, 100, 110, 130, 150, 180, 200, 220, 280, 220, 200, 180, 150, 130, 90, 80],
        }))

        assert.equal('short', result.getSignal())
        assert.equal(280, result.getDebug()['_trigger'])

        let result2 = await cci.period(new IndicatorPeriod(createStrategyContext(394), {
            'sma200': [500, 400],
            'ema200': [500, 400],
            'cci': [80, 90, 100, 110, 130, 150, 180, 190, 199, 180, 150, 130, 90, 80],
        }))

        assert.equal(undefined, result2.getSignal())
    })

    it('strategy cci long', async () => {
        let cci = new CCI()

        let result = await cci.period(new IndicatorPeriod(createStrategyContext(404), {
            'sma200': [550, 400, 388],
            'ema200': [550, 400, 388],
            'cci': [-80, -90, -100, -110, -130, -150, -180, -200, -220, -280, -220, -200, -180, -150, -130, -90, -80],
        }))

        assert.equal('long', result.getSignal())
        assert.equal(-280, result.getDebug()['_trigger'])

        let result2 = await cci.period(new IndicatorPeriod(createStrategyContext(404), {
            'sma200': [500, 400, 388],
            'ema200': [500, 400, 388],
            'cci': [-80, -90, -100, -110, -130, -150, -180, -190, -199, -180, -150, -130, -90, -80],
        }))

        assert.equal(undefined, result2.getSignal())

        let result3 = await cci.period(new IndicatorPeriod(createStrategyContext(404), {
            'sma200': [900, 900, 900],
            'ema200': [500, 400, 388],
            'cci': [-80, -90, -100, -110, -130, -150, -180, -200, -220, -280, -220, -200, -180, -150, -130, -90, -80],
        }))

        assert.equal('long', result3.getSignal())
        assert.equal(-280, result3.getDebug()['_trigger'])
    })

    it('strategy cci long [close]', async () => {
        let cci = new CCI()

        let strategyContext = createStrategyContext(404)
        strategyContext.lastSignal = 'long'

        let result = await cci.period(new IndicatorPeriod(strategyContext, {
            'sma200': [550, 400, 388],
            'ema200': [550, 400, 388],
            'cci': [120, 80, -1],
        }))

        assert.equal('close', result.getSignal())

        let result2 = await cci.period(new IndicatorPeriod(strategyContext, {
            'sma200': [550, 400, 388],
            'ema200': [550, 400, 388],
            'cci': [120, 150, -1],
        }))

        assert.equal(undefined, result2.getSignal())
    })

    it('strategy cci short [close]', async () => {
        let cci = new CCI()

        let strategyContext = createStrategyContext(404)
        strategyContext.lastSignal = 'short'

        let result = await cci.period(new IndicatorPeriod(strategyContext, {
            'sma200': [550, 400, 388],
            'ema200': [550, 400, 388],
            'cci': [-120, -80, 1],
        }))

        assert.equal('close', result.getSignal())

        let result2 = await cci.period(new IndicatorPeriod(strategyContext, {
            'sma200': [550, 400, 388],
            'ema200': [550, 400, 388],
            'cci': [-120, -150, -1],
        }))

        assert.equal(undefined, result2.getSignal())
    })

    let createStrategyContext = (price) => {
        return new StrategyContext(new Ticker('goo', 'goo', 'goo', price))
    }
})
