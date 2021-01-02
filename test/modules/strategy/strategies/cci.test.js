const assert = require('assert');
const CCI = require('../../../../src/modules/strategy/strategies/cci');
const IndicatorBuilder = require('../../../../src/modules/strategy/dict/indicator_builder');
const IndicatorPeriod = require('../../../../src/modules/strategy/dict/indicator_period');
const StrategyContext = require('../../../../src/dict/strategy_context');
const Ticker = require('../../../../src/dict/ticker');

describe('#strategy cci', () => {
  it('cci indicator builder', async () => {
    const indicatorBuilder = new IndicatorBuilder();
    const macd = new CCI();

    macd.buildIndicator(indicatorBuilder, { period: '15m' });
    assert.equal(3, indicatorBuilder.all().length);
  });

  it('strategy cci short', async () => {
    const cci = new CCI();

    const result = await cci.period(
      new IndicatorPeriod(createStrategyContext(394), {
        sma200: [500, 400, 300],
        ema200: [500, 400, 300],
        cci: [90, 100, 110, 130, 150, 180, 200, 220, 280, 220, 200, 180, 150, 130, 90, 80]
      })
    );

    assert.equal('short', result.getSignal());
    assert.equal(280, result.getDebug()._trigger);

    const result2 = await cci.period(
      new IndicatorPeriod(createStrategyContext(394), {
        sma200: [500, 400],
        ema200: [500, 400],
        cci: [80, 90, 100, 110, 130, 150, 180, 190, 199, 180, 150, 130, 90, 80]
      })
    );

    assert.equal(undefined, result2.getSignal());
  });

  it('strategy cci long', async () => {
    const cci = new CCI();

    const result = await cci.period(
      new IndicatorPeriod(createStrategyContext(404), {
        sma200: [550, 400, 388],
        ema200: [550, 400, 388],
        cci: [-80, -90, -100, -110, -130, -150, -180, -200, -220, -280, -220, -200, -180, -150, -130, -90, -80]
      })
    );

    assert.equal('long', result.getSignal());
    assert.equal(-280, result.getDebug()._trigger);

    const result2 = await cci.period(
      new IndicatorPeriod(createStrategyContext(404), {
        sma200: [500, 400, 388],
        ema200: [500, 400, 388],
        cci: [-80, -90, -100, -110, -130, -150, -180, -190, -199, -180, -150, -130, -90, -80]
      })
    );

    assert.equal(undefined, result2.getSignal());

    const result3 = await cci.period(
      new IndicatorPeriod(createStrategyContext(404), {
        sma200: [900, 900, 900],
        ema200: [500, 400, 388],
        cci: [-80, -90, -100, -110, -130, -150, -180, -200, -220, -280, -220, -200, -180, -150, -130, -90, -80]
      })
    );

    assert.equal('long', result3.getSignal());
    assert.equal(-280, result3.getDebug()._trigger);
  });

  it('strategy cci long [close]', async () => {
    const cci = new CCI();

    const strategyContext = createStrategyContext(404);
    strategyContext.lastSignal = 'long';

    const result = await cci.period(
      new IndicatorPeriod(strategyContext, {
        sma200: [550, 400, 388],
        ema200: [550, 400, 388],
        cci: [120, 80, -1]
      })
    );

    assert.equal('close', result.getSignal());

    const result2 = await cci.period(
      new IndicatorPeriod(strategyContext, {
        sma200: [550, 400, 388],
        ema200: [550, 400, 388],
        cci: [120, 150, -1]
      })
    );

    assert.equal(undefined, result2.getSignal());
  });

  it('strategy cci short [close]', async () => {
    const cci = new CCI();

    const strategyContext = createStrategyContext(404);
    strategyContext.lastSignal = 'short';

    const result = await cci.period(
      new IndicatorPeriod(strategyContext, {
        sma200: [550, 400, 388],
        ema200: [550, 400, 388],
        cci: [-120, -80, 1]
      })
    );

    assert.equal('close', result.getSignal());

    const result2 = await cci.period(
      new IndicatorPeriod(strategyContext, {
        sma200: [550, 400, 388],
        ema200: [550, 400, 388],
        cci: [-120, -150, -1]
      })
    );

    assert.equal(undefined, result2.getSignal());
  });

  let createStrategyContext = price => {
    return new StrategyContext({}, new Ticker('goo', 'goo', 'goo', price));
  };
});
