const assert = require('assert');
const OrderBag = require('../../../src/exchange/utils/order_bag');
const ExchangeOrder = require('../../../src/dict/exchange_order');

describe('#order bag utils', function() {
  it('test non strict handling non id type', async () => {
    const orderBag = new OrderBag();

    orderBag.triggerOrder(
      new ExchangeOrder(
        12345,
        'BCHBTC',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'sell',
        ExchangeOrder.TYPE_LIMIT
      )
    );

    const newVar = await orderBag.findOrderById('12345');
    assert.strictEqual(12345, newVar.id);

    orderBag.triggerOrder(
      new ExchangeOrder(
        '12345',
        'BCHBTC',
        ExchangeOrder.STATUS_CANCELED,
        undefined,
        undefined,
        undefined,
        undefined,
        'sell',
        ExchangeOrder.TYPE_LIMIT
      )
    );

    assert.strictEqual(undefined, await orderBag.findOrderById('12345'));
  });

  it('test non strict handling non id type get', async () => {
    const orderBag = new OrderBag();

    orderBag.triggerOrder(
      new ExchangeOrder(
        12345,
        'BCHBTC',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'sell',
        ExchangeOrder.TYPE_LIMIT
      )
    );

    assert.strictEqual(12345, (await orderBag.findOrderById('12345')).id);
    assert.strictEqual(12345, (await orderBag.findOrderById(12345)).id);

    assert.strictEqual(12345, orderBag.get('12345').id);
    assert.strictEqual(12345, orderBag.get(12345).id);
  });

  it('test non strict handling non id type set', async () => {
    const orderBag = new OrderBag();

    orderBag.set([
      new ExchangeOrder(
        12345,
        'BCHBTC',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'sell',
        ExchangeOrder.TYPE_LIMIT
      ),
      new ExchangeOrder(
        12346,
        'BCHBTC',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'sell',
        ExchangeOrder.TYPE_LIMIT
      )
    ]);

    assert.strictEqual(12345, (await orderBag.findOrderById('12345')).id);
    assert.strictEqual(12345, (await orderBag.findOrderById(12345)).id);

    assert.strictEqual(12345, orderBag.get('12345').id);
    assert.strictEqual(12345, orderBag.get(12345).id);

    orderBag.delete(12345);
    assert.strictEqual(undefined, orderBag.get(12345));

    assert.strictEqual(12346, orderBag.all()[0].id);
  });
});
