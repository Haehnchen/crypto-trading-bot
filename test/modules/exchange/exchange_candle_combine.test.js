const assert = require('assert');
const ExchangeCandleCombine = require('../../../src/modules/exchange/exchange_candle_combine');

const Candlestick = require('../../../src/dict/candlestick');

describe('#exchange candle combine', () => {
  it('test that times are combined for exchanges', async () => {
    const calls = [];

    const exchangeCandleCombine = new ExchangeCandleCombine({
      getLookbacksForPair: async () => {
        return createCandles();
      },
      getLookbacksSince: async (exchange, symbol, period, start) => {
        calls.push([exchange, symbol, period, start]);

        switch (exchange) {
          case 'binance':
            return createCandles();
          case 'gap':
            return createCandlesWithGap();
          default:
            return [];
        }
      }
    });

    const result = await exchangeCandleCombine.fetchCombinedCandles('bitmex', 'XTBUSD', '15m', [
      {
        name: 'binance',
        symbol: 'BTCUSD'
      },
      {
        name: 'gap',
        symbol: 'FOOUSD'
      },
      {
        name: 'foobar',
        symbol: 'FOOUSD'
      }
    ]);

    assert.equal(result.bitmex.length, 22);
    assert.equal(result['binance' + 'BTCUSD'].length, 22);

    assert.equal(result.bitmex[0].open, 2);
    assert.equal(result['binance' + 'BTCUSD'][0].open, 2);

    assert.equal(result.bitmex[0].close, 2.1);
    assert.equal(result['binance' + 'BTCUSD'][0].close, 2.1);

    assert.equal(result.bitmex[0].time > result.bitmex[1].time, true);
    assert.equal(result['binance' + 'BTCUSD'][0].time > result['binance' + 'BTCUSD'][1].time, true);
    assert.equal(result['gap' + 'FOOUSD'][0].time > result['gap' + 'FOOUSD'][1].time, true);

    assert.equal(result.bitmex[result.bitmex.length - 1].close, 46.2);
    assert.equal(result['binance' + 'BTCUSD'][result['binance' + 'BTCUSD'].length - 1].close, 46.2);

    assert.equal(result['gap' + 'FOOUSD'].length, 22);
    assert.equal(calls.filter(c => c[3] === 1393473600).length, 3);

    assert.equal('foobar' in result['gap' + 'FOOUSD'], false);
  });

  it('test that only main exchagne is given', async () => {
    const exchangeCandleCombine = new ExchangeCandleCombine({
      getLookbacksForPair: async () => {
        return createCandles();
      },
      getLookbacksSince: async () => {
        return createCandles();
      }
    });

    const result = await exchangeCandleCombine.fetchCombinedCandles('bitmex', 'XTBUSD', '15m');

    assert.equal(result.bitmex.length, 22);
    assert.equal(result.bitmex[0].close, 2.1);

    assert.equal(result.bitmex[0].time > result.bitmex[1].time, true);

    assert.equal(result.bitmex[result.bitmex.length - 1].close, 46.2);
  });

  function createCandles() {
    const candles = [];

    // 2014-02-27T09:30:00.000Z
    const start = 1393493400;

    for (let i = 1; i < 23; i++) {
      candles.push(new Candlestick(start - 15 * i * 60, i * 2, i * 1.1, i * 0.9, i * 2.1, i * 100));
    }

    return candles;
  }

  function createCandlesWithGap() {
    const candles = [];

    // 2014-02-27T09:30:00.000Z
    const start = 1393493400;

    for (let i = 1; i < 23; i++) {
      if (i % 2) {
        continue;
      }

      candles.push(new Candlestick(start - 15 * i * 60, i * 2, i * 1.1, i * 0.9, i * 2.1, i * 100));
    }

    return candles;
  }
});
