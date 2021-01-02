const assert = require('assert');
const AwesomeOscillatorCrossZero = require('../../../../src/modules/strategy/strategies/awesome_oscillator_cross_zero');
const IndicatorBuilder = require('../../../../src/modules/strategy/dict/indicator_builder');
const IndicatorPeriod = require('../../../../src/modules/strategy/dict/indicator_period');
const StrategyContext = require('../../../../src/dict/strategy_context');
const Ticker = require('../../../../src/dict/ticker');

describe('#strategy AwesomeOscillatorCrossZero', () => {
  it('AwesomeOscillatorCrossZero indicator builder', async () => {
    const indicatorBuilder = new IndicatorBuilder();
    const aoCross = new AwesomeOscillatorCrossZero();

    aoCross.buildIndicator(indicatorBuilder, { period: '15m' });
    assert.equal(2, indicatorBuilder.all().length);
  });

  it('AwesomeOscillatorCrossZero long', async () => {
    const aoCross = new AwesomeOscillatorCrossZero();

    assert.equal(
      'long',
      (
        await aoCross.period(
          new IndicatorPeriod(createStrategyContext(404), {
            sma200: [500, 400, 388],
            ao: [-1, 0.1, 0.3]
          })
        )
      ).getSignal()
    );

    assert.equal(
      undefined,
      (
        await aoCross.period(
          new IndicatorPeriod(createStrategyContext(404), {
            sma200: [500, 400, 388],
            ao: [-2, -1, -0.3]
          })
        )
      ).getSignal()
    );

    assert.equal(
      undefined,
      (
        await aoCross.period(
          new IndicatorPeriod(createStrategyContext(404), {
            sma200: [500, 400, 388],
            ao: [2, -1, -0.3]
          })
        )
      ).getSignal()
    );
  });

  it('AwesomeOscillatorCrossZero long (close)', async () => {
    const aoCross = new AwesomeOscillatorCrossZero();

    let context = new StrategyContext({}, new Ticker('goo', 'goo', 'goo', 404));
    context.lastSignal = 'long';

    assert.equal(
      'close',
      (
        await aoCross.period(
          new IndicatorPeriod(context, {
            sma200: [500, 400, 388],
            ao: [0.1, -1, 0.3]
          })
        )
      ).getSignal()
    );

    context = new StrategyContext({}, new Ticker('goo', 'goo', 'goo', 404));
    context.lastSignal = 'short';

    assert.equal(
      undefined,
      (
        await aoCross.period(
          new IndicatorPeriod(context, {
            sma200: [500, 400, 388],
            ao: [0.1, -1, 0.3]
          })
        )
      ).getSignal()
    );
  });

  it('AwesomeOscillatorCrossZero short', async () => {
    const aoCross = new AwesomeOscillatorCrossZero();

    assert.equal(
      'short',
      (
        await aoCross.period(
          new IndicatorPeriod(createStrategyContext(394), {
            sma200: [500, 400, 399],
            ao: [1, -0.1, -0.2]
          })
        )
      ).getSignal()
    );

    assert.equal(
      undefined,
      (
        await aoCross.period(
          new IndicatorPeriod(createStrategyContext(403), {
            sma200: [500, 400, 399],
            ao: [1, -0.1, -0.2]
          })
        )
      ).getSignal()
    );
  });

  it('AwesomeOscillatorCrossZero short (close)', async () => {
    const aoCross = new AwesomeOscillatorCrossZero();

    const context = new StrategyContext({}, new Ticker('goo', 'goo', 'goo', 394));
    context.lastSignal = 'short';

    assert.equal(
      'close',
      (
        await aoCross.period(
          new IndicatorPeriod(context, {
            sma200: [500, 400, 399],
            ao: [-0.1, 1, -0.2]
          })
        )
      ).getSignal()
    );
  });

  let createStrategyContext = price => {
    return new StrategyContext({}, new Ticker('goo', 'goo', 'goo', price));
  };
});
