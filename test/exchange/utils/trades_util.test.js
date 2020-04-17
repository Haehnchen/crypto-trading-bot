const assert = require('assert');
const TradesUtil = require('../../../src/exchange/utils/trades_util');
const moment = require('moment');

describe('#trades utils', function() {
  it('position entry is extracted for short position', () => {
    const trades = [
      {
        side: 'sell',
        price: 0.17265,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 2027.2
      },
      {
        side: 'sell',
        price: 0.16234,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 1851.7
      },
      {
        side: 'sell',
        price: 0.01,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 1100006.5
      }
    ];

    const position = TradesUtil.findPositionEntryFromTrades(trades, 2027.2 + 1851.7, 'short');

    assert.strictEqual(parseFloat(position.average_price.toFixed(5)), 0.16773);
    assert.notStrictEqual(position.time, undefined);
  });

  it('position entry is extracted for short position with target hit', () => {
    const trades = [
      {
        side: 'buy',
        price: 0.17065,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 800
      },
      {
        side: 'sell',
        price: 0.17265,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 2027.2
      },
      {
        side: 'sell',
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 1851.7
      },
      {
        side: 'sell',
        price: 0.01,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 100106.5
      }
    ];

    const position = TradesUtil.findPositionEntryFromTrades(trades, 2027.2 + 1851.7 - 800, 'short');

    assert.strictEqual(parseFloat(position.average_price.toFixed(5)), 0.17265);
    assert.notStrictEqual(position.time, undefined);
  });

  it('position entry is extracted for long position', () => {
    const trades = [
      {
        side: 'buy',
        price: 0.17265,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 2027.2
      },
      {
        side: 'buy',
        price: 0.17265,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 1851.7
      },
      {
        side: 'sell',
        price: 0.01,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 100106.5
      }
    ];

    const position = TradesUtil.findPositionEntryFromTrades(trades, 2027.2 + 1851.7, 'long');

    assert.strictEqual(parseFloat(position.average_price.toFixed(5)), 0.17265);
    assert.notStrictEqual(position.time, undefined);
  });

  it('position entry is extracted for long position with target it', () => {
    const trades = [
      {
        side: 'sell',
        price: 0.18065,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 800
      },
      {
        side: 'buy',
        price: 0.17265,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 2027.2
      },
      {
        side: 'buy',
        price: 0.17265,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 1851.7
      },
      {
        side: 'sell',
        price: 0.01,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 100106.5
      }
    ];

    const position = TradesUtil.findPositionEntryFromTrades(trades, 2027.2 + 1851.7 - 800, 'long');

    assert.strictEqual(parseFloat(position.average_price.toFixed(5)), 0.17265);
    assert.notStrictEqual(position.time, undefined);
  });

  it('test outdated trade is possible a closed trade and should not provide a position entry', () => {
    const trades = [
      {
        side: 'buy',
        price: 0.17265,
        symbol: 'XRPBUSD',
        time: new Date(moment().subtract(5, 'days')),
        size: 2027.2
      },
      {
        side: 'sell',
        price: 0.16234,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 1851.7
      },
      {
        side: 'sell',
        price: 0.01,
        symbol: 'XRPBUSD',
        time: new Date(),
        size: 1100006.5
      }
    ];

    const position = TradesUtil.findPositionEntryFromTrades(trades, 2027.2 + 1851.7, 'short');
    assert.strictEqual(position, undefined);
  });
});
