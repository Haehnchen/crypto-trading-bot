const assert = require('assert');
const orderUtil = require('../../utils/order_util');
const Position = require('../../dict/position');
const ExchangeOrder = require('../../dict/exchange_order');

describe('#order util', function() {
  it('calculate order amount', () => {
    assert.equal(0.0154012, orderUtil.calculateOrderAmount(6493, 100).toFixed(8));
  });

  it('sync stoploss exchange order (long)', () => {
    const position = new Position('LTCUSD', 'long', 4, 0, new Date());

    // stop loss create
    assert.deepEqual([{ amount: 4 }], orderUtil.syncStopLossOrder(position, []));

    // stop loss update
    assert.deepEqual(
      [{ id: 'foobar', amount: 4 }],
      orderUtil.syncStopLossOrder(position, [
        new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'stop')
      ])
    );

    // stop loss: missing value
    assert.deepEqual(
      [{ id: 'foobar', amount: 4 }],
      orderUtil.syncStopLossOrder(position, [
        new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'limit'),
        new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, -2, false, 'our_id', 'buy', 'stop')
      ])
    );

    assert.deepEqual(
      [{ id: 'foobar', amount: 4 }],
      orderUtil.syncStopLossOrder(position, [
        new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'limit'),
        new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, -5, false, 'our_id', 'buy', 'stop')
      ])
    );

    // stop loss correct
    assert.deepEqual(
      [],
      orderUtil.syncStopLossOrder(position, [
        new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'limit'),
        new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, -4, false, 'our_id', 'buy', 'stop')
      ])
    );
  });

  it('sync stoploss exchange order (short)', () => {
    const position = new Position('LTCUSD', 'short', -4, 0, new Date());

    // stop loss update
    assert.deepEqual(
      [],
      orderUtil.syncStopLossOrder(position, [
        new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 4, false, 'our_id', 'buy', 'stop')
      ])
    );

    // stop loss create
    assert.deepEqual([{ amount: 4 }], orderUtil.syncStopLossOrder(position, []));
  });

  it('calculate increment size', () => {
    assert.equal(orderUtil.calculateNearestSize(0.0085696, 0.00001), 0.00856);
    assert.equal(orderUtil.calculateNearestSize(50.55, 2.5), 50);

    assert.equal(orderUtil.calculateNearestSize(50.22, 1), 50);
    assert.equal(orderUtil.calculateNearestSize(50.88, 1), 50);

    assert.equal(orderUtil.calculateNearestSize(-149.87974, 0.01), -149.87);
  });
});
