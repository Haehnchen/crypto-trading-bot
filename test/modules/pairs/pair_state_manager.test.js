const assert = require('assert');
const PairStateManager = require('../../../src/modules/pairs/pair_state_manager');

const ExchangeOrder = require('../../../src/dict/exchange_order');
const Order = require('../../../src/dict/order');
const OrderCapital = require('../../../src/dict/order_capital');

describe('#pair state manager', function() {
  it('test pair state changes', () => {
    const manager = new PairStateManager(
      { info: () => {}, debug: () => {} },
      { getSymbolCapital: () => OrderCapital.createAsset(12) },
      { getConfig: () => 1 },
      {},
      {},
      { addInterval: () => {}, clearInterval: () => {} }
    );

    manager.update('foo1', 'BTCUSD2', 'long', { foobar: 'test' });
    manager.update('foo2', 'BTCUSD3', 'short', { foobar: 'test' });
    manager.update('foo3', 'BTCUSD4', 'close', { foobar: 'test' });
    manager.update('foo4', 'BTCUSD5', 'cancel', { foobar: 'test' });

    assert.equal(manager.isNeutral('foo', 'BTCUSD'), true);
    assert.equal(manager.get('foo1', 'BTCUSD2').exchange, 'foo1');

    assert.equal(manager.getBuyingPairs()[0].symbol, 'BTCUSD2');
    assert.equal(manager.getSellingPairs()[0].symbol, 'BTCUSD3');
    assert.equal(manager.getClosingPairs()[0].symbol, 'BTCUSD4');
    assert.equal(manager.getCancelPairs()[0].symbol, 'BTCUSD5');

    assert.equal(manager.isNeutral('foo1', 'BTCUSD2'), false);
    assert.equal(manager.isNeutral('foo2', 'BTCUSD3'), false);

    manager.clear('UNKNOWN', 'FOOBAR');
    manager.clear('foo2', 'BTCUSD3');

    assert.equal(manager.isNeutral('foo2', 'BTCUSD3'), true);
    assert.equal(manager.isNeutral('UNKNOWN', 'FOOBAR'), true);

    const state = manager.get('foo4', 'BTCUSD5', 'order', { foo: 'foo' });
    state.setOrder(Order.createMarketOrder('FOO', 'FOO'));
    state.setExchangeOrder(
      new ExchangeOrder(
        25035356,
        'FOOUSD',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    );

    assert.equal(manager.get('foo4', 'BTCUSD5', 'order', { foo: 'foo' }).getExchangeOrder().symbol, 'FOOUSD');
    assert.equal(manager.get('foo4', 'BTCUSD5', 'order', { foo: 'foo' }).exchangeOrder.symbol, 'FOOUSD');
  });

  it('test pair state should be cleared', () => {
    const manager = new PairStateManager(
      { info: () => {}, debug: () => {} },
      { getSymbolCapital: () => OrderCapital.createAsset(12) },
      { getConfig: () => 1 },
      {},
      {},
      { addInterval: () => {}, clearInterval: () => {} }
    );

    manager.update('foo1', 'BTCUSD2', 'long', { foobar: 'test' });
    const state = manager.get('foo1', 'BTCUSD2');
    assert.equal(state.getSymbol(), 'BTCUSD2');

    assert.equal(state.clear(), undefined);
  });

  it('test pair state provides callback and calls internal functions', async () => {
    let addIntervalCallback;

    let onPairStateExecutionTick;
    let adjustOpenOrdersPrice;

    const manager = new PairStateManager(
      { info: () => {}, debug: () => {} },
      { getSymbolCapital: () => OrderCapital.createAsset(12) },
      { getConfig: () => 1 },
      {
        onPairStateExecutionTick: pairState => {
          onPairStateExecutionTick = pairState;
        }
      },
      {
        adjustOpenOrdersPrice: pairState => {
          adjustOpenOrdersPrice = pairState;
        }
      },
      {
        addInterval: (name, delay, func) => {
          addIntervalCallback = func;
        }
      }
    );

    manager.update('foo1', 'BTCUSD2', 'long', { foobar: 'test' });

    await addIntervalCallback();

    assert.equal(onPairStateExecutionTick.getSymbol(), 'BTCUSD2');
    assert.equal(adjustOpenOrdersPrice.getSymbol(), 'BTCUSD2');
  });
});
