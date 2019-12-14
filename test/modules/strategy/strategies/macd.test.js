const assert = require('assert');
const MACD = require('../../../../modules/strategy/strategies/macd');
const IndicatorBuilder = require('../../../../modules/strategy/dict/indicator_builder');
const IndicatorPeriod = require('../../../../modules/strategy/dict/indicator_period');
const StrategyContext = require('../../../../dict/strategy_context');
const Ticker = require('../../../../dict/ticker');

describe('#strategy macd', () => {
  it('macd indicator builder', async () => {
    const indicatorBuilder = new IndicatorBuilder();
    const macd = new MACD();

    macd.buildIndicator(indicatorBuilder, { period: '15m' });
    assert.equal(3, indicatorBuilder.all().length);
  });

  it('macd long', async () => {
    const macd = new MACD();

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

  it('macd long (close)', async () => {
    const macd = new MACD();

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

  it('macd short', async () => {
    const macd = new MACD();

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

  it('macd short (close)', async () => {
    const macd = new MACD();

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
