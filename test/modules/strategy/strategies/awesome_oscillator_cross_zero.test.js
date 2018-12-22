let assert = require('assert')
let AwesomeOscillatorCrossZero = require('../../../../modules/strategy/strategies/awesome_oscillator_cross_zero')
let IndicatorBuilder = require('../../../../modules/strategy/dict/indicator_builder')
let IndicatorPeriod = require('../../../../modules/strategy/dict/indicator_period')
let StrategyContext = require('../../../../dict/strategy_context')
let Ticker = require('../../../../dict/ticker')

describe('#strategy AwesomeOscillatorCrossZero', () => {
    it('AwesomeOscillatorCrossZero indicator builder', async () => {
        let indicatorBuilder = new IndicatorBuilder()
        let aoCross = new AwesomeOscillatorCrossZero()

        aoCross.buildIndicator(indicatorBuilder, {'period': '15m'})
        assert.equal(2, indicatorBuilder.all().length)
    });

    it('AwesomeOscillatorCrossZero long', async () => {
        let aoCross = new AwesomeOscillatorCrossZero()

        assert.equal('long', (await aoCross.period(new IndicatorPeriod(createStrategyContext(404), {
            'sma200': [500, 400, 388],
            'ao': [-1, 0.1, 0.3],
        })))['signal'])

        assert.equal(undefined, (await aoCross.period(new IndicatorPeriod(createStrategyContext(404), {
            'sma200': [500, 400, 388],
            'ao': [-2, -1, -0.3],
        })))['signal'])

        assert.equal(undefined, (await aoCross.period(new IndicatorPeriod(createStrategyContext(404), {
            'sma200': [500, 400, 388],
            'ao': [2, -1, -0.3],
        })))['signal'])
    })

    it('AwesomeOscillatorCrossZero long (close)', async () => {
        let aoCross = new AwesomeOscillatorCrossZero()

        let context = new StrategyContext(new Ticker('goo', 'goo', 'goo', 404))
        context.lastSignal = 'long'

        assert.equal('close', (await aoCross.period(new IndicatorPeriod(context, {
            'sma200': [500, 400, 388],
            'ao': [0.1, -1, 0.3],
        })))['signal'])

        context = new StrategyContext(new Ticker('goo', 'goo', 'goo', 404))
        context.lastSignal = 'short'

        assert.equal(undefined, (await aoCross.period(new IndicatorPeriod(context, {
            'sma200': [500, 400, 388],
            'ao': [ 0.1, -1, 0.3],
        })))['signal'])
    })

    it('AwesomeOscillatorCrossZero short', async () => {
        let aoCross = new AwesomeOscillatorCrossZero()

        assert.equal('short', (await aoCross.period(new IndicatorPeriod(createStrategyContext(394), {
            'sma200': [500, 400, 399],
            'ao': [1, -0.1, -0.2],
        })))['signal'])

        assert.equal(undefined, (await aoCross.period(new IndicatorPeriod(403, {
            'sma200': [500, 400, 399],
            'ao': [1, -0.1, -0.2],
        }))['signal']))
    })

    it('AwesomeOscillatorCrossZero short (close)', async () => {
        let aoCross = new AwesomeOscillatorCrossZero()

        let context = new StrategyContext(new Ticker('goo', 'goo', 'goo', 394))
        context.lastSignal = 'short'

        assert.equal('close', (await aoCross.period(new IndicatorPeriod(context, {
            'sma200': [500, 400, 399],
            'ao': [-0.1, 1, -0.2],
        })))['signal'])
    })

    let createStrategyContext = (price) => {
        return new StrategyContext(new Ticker('goo', 'goo', 'goo', price))
    }
})
