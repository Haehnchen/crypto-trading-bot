const assert = require('assert');
const Order = require('../../src/dict/order');

describe('#order dict test', function() {
  it('test order dict creation (post only)', () => {
    const order = Order.createLimitPostOnlyOrder('BTCUSD', 'long', 12, 12, { foobar: 'test' });

    assert.equal(order.options.foobar, 'test');
    assert.equal(order.options.post_only, true);
  });

  it('test order dict creation (post only + adjusted) [long]', () => {
    const order = Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder('BTCUSD', 12);

    assert.equal(order.price, undefined);
    assert.equal(order.options.adjust_price, true);
    assert.equal(order.amount, 12);
    assert.equal(order.side, 'long');

    assert.equal(order.hasAdjustedPrice(), true);
  });

  it('test order dict creation (post only + adjusted) [short]', () => {
    const order = Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder('BTCUSD', -12);

    assert.equal(order.price, undefined);
    assert.equal(order.options.adjust_price, true);
    assert.equal(order.amount, -12);
    assert.equal(order.side, 'short');

    assert.equal(order.hasAdjustedPrice(), true);
  });

  it('test order close creation', () => {
    const order = Order.createCloseOrderWithPriceAdjustment('BTCUSD', -12);

    assert.equal(order.price, undefined);
    assert.equal(order.options.adjust_price, true);
    assert.equal(order.options.close, true);

    assert.equal(order.side, 'short');
    assert.equal(order.hasAdjustedPrice(), true);
    assert.deepEqual(order.options, { close: true, adjust_price: true, post_only: true });

    assert.equal(Order.createCloseOrderWithPriceAdjustment('BTCUSD', 12).side, 'long');
  });

  it('test order close creation for closes', () => {
    const order = Order.createCloseLimitPostOnlyReduceOrder('BTCUSD', -12, 0.4);

    assert.equal(order.symbol, 'BTCUSD');
    assert.equal(order.price, -12);
    assert.equal(order.amount, 0.4);

    assert.equal(order.side, 'short');
    assert.deepEqual(order.options, { close: true, post_only: true });
  });

  it('test market order', () => {
    let order = Order.createMarketOrder('BTCUSD', -12);

    assert.equal(order.price < 0, true);
    assert.equal(order.side, 'short');

    order = Order.createMarketOrder('BTCUSD', 12);

    assert.equal(order.price > 0, true);
    assert.equal(order.side, 'long');
  });

  it('test retry order', () => {
    const order = Order.createRetryOrder(Order.createMarketOrder('BTCUSD', 12));

    assert.strictEqual(order.price > 0, true);
    assert.strictEqual(order.side, 'long');
    assert.strictEqual(order.amount, 12);
  });

  it('test retry order with amount [long]', () => {
    let order = Order.createRetryOrder(Order.createMarketOrder('BTCUSD', 12), -16);

    assert.strictEqual(order.price > 0, true);
    assert.strictEqual(order.side, 'long');
    assert.strictEqual(order.amount, 16);

    order = Order.createRetryOrder(Order.createMarketOrder('BTCUSD', 12), 16);

    assert.strictEqual(order.price > 0, true);
    assert.strictEqual(order.side, 'long');
    assert.strictEqual(order.amount, 16);
  });

  it('test retry order with amount [short]', () => {
    let order = Order.createRetryOrder(Order.createMarketOrder('BTCUSD', -12), -16);

    assert.strictEqual(order.price > 0, false);
    assert.strictEqual(order.side, 'short');
    assert.strictEqual(order.amount, -16);

    order = Order.createRetryOrder(Order.createMarketOrder('BTCUSD', -12), 16);

    assert.strictEqual(order.price > 0, false);
    assert.strictEqual(order.side, 'short');
    assert.strictEqual(order.amount, -16);
  });
});
