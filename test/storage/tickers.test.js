const assert = require('assert');
const moment = require('moment');
const Tickers = require('../../src/storage/tickers');
const Ticker = require('../../src/dict/ticker');

describe('#tickers', function() {
  it('test getting update tickers', () => {
    const tickers = new Tickers();
    const ticker = new Ticker('foobar', 'BTCUSD', 1234, 1337, 1338);

    tickers.set(ticker);
    ticker.createdAt = moment()
      .subtract(5000, 'ms')
      .toDate();

    assert.equal(tickers.get('foobar', 'BTCUSD').ask, 1338);
    assert.equal(tickers.getIfUpToDate('foobar', 'BTCUSD', 1000), undefined);

    assert.equal(tickers.getIfUpToDate('foobar', 'BTCUSD', 7000).ask, 1338);
  });
});
