const assert = require('assert');
const fs = require('fs');
const Resample = require('../../src/utils/resample');

describe('#resample of candles', () => {
  it('should resample 1 hour candles', () => {
    const candles = Resample.resampleMinutes(createCandleFixtures(), 60);

    const firstFullCandle = candles[1];

    assert.equal(12, firstFullCandle._candle_count);

    assert.equal(firstFullCandle.time, 1533142800);
    assert.equal(firstFullCandle.open, 7600);
    assert.equal(firstFullCandle.high, 7609.5);
    assert.equal(firstFullCandle.low, 7530);
    assert.equal(firstFullCandle.close, 7561.5);
    assert.equal(firstFullCandle.volume, 174464214);

    assert.equal(candles[2].time, 1533139200);
  });

  it('should resample 15m candles', () => {
    const candles = Resample.resampleMinutes(createCandleFixtures(), 15);

    const firstFullCandle = candles[1];

    assert.equal(3, firstFullCandle._candle_count);

    assert.equal(firstFullCandle.time, 1533142800);
    assert.equal(firstFullCandle.open, 7547.5);
    assert.equal(firstFullCandle.high, 7562);
    assert.equal(firstFullCandle.low, 7530);
    assert.equal(firstFullCandle.close, 7561.5);
    assert.equal(firstFullCandle.volume, 45596804);

    assert.equal(candles[2].time, 1533141900);
  });

  it('should format period based on unit', () => {
    assert.strictEqual(Resample.convertPeriodToMinute('15m'), 15);
    assert.strictEqual(Resample.convertPeriodToMinute('30M'), 30);
    assert.strictEqual(Resample.convertPeriodToMinute('1H'), 60);
    assert.strictEqual(Resample.convertPeriodToMinute('2h'), 120);
    assert.strictEqual(Resample.convertPeriodToMinute('1w'), 10080);
    assert.strictEqual(Resample.convertPeriodToMinute('2w'), 20160);
    assert.strictEqual(Resample.convertPeriodToMinute('1y'), 3588480);
  });

  it('test that resample starting time is matching given candle lookback', () => {
    const candles = [];

    // 2014-02-27T09:30:00.000Z
    const start = 1393493400;

    for (let i = 1; i < 23; i++) {
      candles.push({
        time: start - 15 * i * 60,
        volume: i * 100,
        open: i * 2,
        close: i * 2.1,
        high: i * 1.1,
        low: i * 0.9
      });
    }

    const resampleCandles = Resample.resampleMinutes(candles, 60);

    assert.equal(new Date(resampleCandles[0].time * 1000).getUTCHours(), 10);

    const firstFullCandle = resampleCandles[1];
    assert.equal(firstFullCandle._candle_count, 4);
    assert.equal(firstFullCandle.time, 1393491600);

    assert.equal(resampleCandles.length, 6);

    assert.equal(resampleCandles[0].time, 1393495200);
    assert.equal(resampleCandles[4].time, 1393480800);
    assert.equal(resampleCandles[4]._candle_count, 4);
  });

  let createCandleFixtures = function() {
    return JSON.parse(fs.readFileSync(`${__dirname}/fixtures/xbt-usd-5m.json`, 'utf8'));
  };
});
