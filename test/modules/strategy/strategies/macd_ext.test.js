const assert = require('assert');
const MacdExt = require('../../../../src/modules/strategy/strategies/macd_ext');
const IndicatorBuilder = require('../../../../src/modules/strategy/dict/indicator_builder');
const IndicatorPeriod = require('../../../../src/modules/strategy/dict/indicator_period');
const StrategyContext = require('../../../../src/dict/strategy_context');
const Ticker = require('../../../../src/dict/ticker');

describe('#strategy macd', () => {
  it('macd indicator builder', async () => {
    const indicatorBuilder = new IndicatorBuilder();
    const macd = new MacdExt();

    macd.buildIndicator(indicatorBuilder, {
      period: '15m'
    });

    assert.equal(2, indicatorBuilder.all().length);
  });

  it('macd_ext long', async () => {
    const macd = new MacdExt();

    assert.equal(
      'long',
      (
        await macd.period(
          new IndicatorPeriod(createStrategyContext(404), {
            sma200: [500, 400, 388],
            ema200: [500, 400, 388],
            macd: [{ histogram: -1 }, { histogram: 0.1 }, { histogram: 0.3 }]
          })
        )
      ).getSignal()
    );

    assert.equal(
      undefined,
      (
        await macd.period(
          new IndicatorPeriod(createStrategyContext(404), {
            sma200: [500, 400, 388],
            ema200: [500, 400, 388],
            macd: [{ histogram: -2 }, { histogram: -1 }, { histogram: -0.3 }]
          })
        )
      ).getSignal()
    );

    assert.equal(
      undefined,
      (
        await macd.period(
          new IndicatorPeriod(createStrategyContext(404), {
            sma200: [500, 400, 388],
            ema200: [500, 400, 388],
            macd: [{ histogram: 2 }, { histogram: -1 }, { histogram: -0.3 }]
          })
        )
      ).getSignal()
    );
  });

  it('macd_ext long (close)', async () => {
    const macd = new MacdExt();

    let context = new StrategyContext(new Ticker('goo', 'goo', 'goo', 404));
    context.lastSignal = 'long';

    assert.equal(
      'close',
      (
        await macd.period(
          new IndicatorPeriod(context, {
            sma200: [500, 400, 388],
            ema200: [500, 400, 388],
            macd: [{ histogram: 0.1 }, { histogram: -1 }, { histogram: 0.3 }]
          })
        )
      ).getSignal()
    );

    context = new StrategyContext(new Ticker('goo', 'goo', 'goo', 404));
    context.lastSignal = 'short';

    assert.equal(
      undefined,
      (
        await macd.period(
          new IndicatorPeriod(context, {
            sma200: [500, 400, 388],
            ema200: [500, 400, 388],
            macd: [{ histogram: 0.1 }, { histogram: -1 }, { histogram: 0.3 }]
          })
        )
      ).getSignal()
    );
  });

  it('macd_ext short', async () => {
    const macd = new MacdExt();

    assert.equal(
      'short',
      (
        await macd.period(
          new IndicatorPeriod(createStrategyContext(394), {
            sma200: [500, 400, 399],
            ema200: [500, 400, 399],
            macd: [{ histogram: 1 }, { histogram: -0.1 }, { histogram: -0.2 }]
          })
        )
      ).getSignal()
    );

    assert.equal(
      undefined,
      (
        await macd.period(
          new IndicatorPeriod(createStrategyContext(403), {
            sma200: [500, 400, 399],
            ema200: [500, 400, 399],
            macd: [{ histogram: 1 }, { histogram: -0.1 }, { histogram: -0.2 }]
          })
        )
      ).getSignal()
    );
  });

  it('macd_ext short (close)', async () => {
    const macd = new MacdExt();

    const context = new StrategyContext(new Ticker('goo', 'goo', 'goo', 394));
    context.lastSignal = 'short';

    assert.equal(
      'close',
      (
        await macd.period(
          new IndicatorPeriod(context, {
            sma200: [500, 400, 399],
            ema200: [500, 400, 399],
            macd: [{ histogram: -0.1 }, { histogram: 1 }, { histogram: -0.2 }]
          })
        )
      ).getSignal()
    );
  });

  let createStrategyContext = price => {
    return new StrategyContext(new Ticker('goo', 'goo', 'goo', price));
  };
});
