const assert = require('assert');
const RiskRewardRatioCalculator = require('../../../src/modules/order/risk_reward_ratio_calculator');
const Position = require('../../../src/dict/position');
const ExchangeOrder = require('../../../src/dict/exchange_order');

describe('#risk reward order calculation', function() {
  const fakeLogger = { info: () => {} };
  it('calculate risk reward orders for long', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    let result = calculator.calculateForOpenPosition(new Position('BTCUSD', 'long', 0.15, 0, new Date(), 6501.76));

    assert.equal(result.stop.toFixed(1), 6306.7);
    assert.equal(result.target.toFixed(1), 6891.9);

    result = calculator.calculateForOpenPosition(new Position('BTCUSD', 'long', 0.15, 0, new Date(), 6501.76), {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    assert.equal(result.stop.toFixed(1), 6469.3);
    assert.equal(result.target.toFixed(1), 6518.0);
  });

  it('calculate risk reward orders for short', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    let result = calculator.calculateForOpenPosition(new Position('BTCUSD', 'short', -0.15, 0, new Date(), 6501.76));

    assert.equal(result.stop.toFixed(1), 6696.8);
    assert.equal(result.target.toFixed(1), 6111.7);

    result = calculator.calculateForOpenPosition(new Position('BTCUSD', 'short', -0.15, 0, new Date(), 6501.76), {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    assert.equal(result.stop.toFixed(1), 6534.3);
    assert.equal(result.target.toFixed(1), 6485.5);
  });

  it('create risk reward ratio changeset orders (long)', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    const position = new Position('BTCUSD', 'long', 0.15, 0, new Date(), 6501.76);

    const result = await calculator.syncRatioRewardOrders(position, [], { stop_percent: 0.5, target_percent: 0.25 });

    assert.deepEqual(result.stop, { amount: 0.15, price: -6469.251200000001 });
    assert.deepEqual(result.target, { amount: 0.15, price: -6518.0144 });

    // target create
    assert.deepEqual(
      await calculator.syncRatioRewardOrders(
        position,
        [new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 0.15, false, 'our_id', 'buy', 'stop')],
        { stop_percent: 0.5, target_percent: 0.25 }
      ),
      {
        target: {
          amount: 0.15,
          price: -6518.0144
        }
      }
    );

    // stop create
    assert.deepEqual(
      await calculator.syncRatioRewardOrders(
        position,
        [new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 0.15, false, 'our_id', 'buy', 'limit')],
        { stop_percent: 0.5, target_percent: 0.25 }
      ),
      {
        stop: {
          amount: 0.15,
          price: -6469.251200000001
        }
      }
    );
  });

  it('update risk reward ratio changeset orders (long)', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    const position = new Position('BTCUSD', 'long', 0.15, 0, new Date(), 6501.76);
    const orders = [
      new ExchangeOrder(
        '12345-12345',
        undefined,
        undefined,
        6601.76,
        0.2,
        undefined,
        undefined,
        'sell',
        ExchangeOrder.TYPE_STOP
      ),
      new ExchangeOrder(
        '54321-54321',
        undefined,
        undefined,
        6401.76,
        0.2,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    ];

    const result = await calculator.syncRatioRewardOrders(position, orders, {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    assert.deepEqual(result.stop, { amount: -0.15, id: '12345-12345' });
    assert.deepEqual(result.target, { amount: -0.15, id: '54321-54321' });
  });

  it('create risk reward ratio changeset orders (short)', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    const position = new Position('BTCUSD', 'short', -0.15, 0, new Date(), 6501.76);

    const result = await calculator.syncRatioRewardOrders(position, [], { stop_percent: 0.5, target_percent: 0.25 });

    assert.deepEqual(result.stop, { amount: 0.15, price: 6534.2688 });
    assert.deepEqual(result.target, { amount: 0.15, price: 6485.5056 });

    // target create
    assert.deepEqual(
      await calculator.syncRatioRewardOrders(
        position,
        [new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 0.15, false, 'our_id', 'buy', 'stop')],
        { stop_percent: 0.5, target_percent: 0.25 }
      ),
      {
        target: {
          amount: 0.15,
          price: 6485.5056
        }
      }
    );

    // stop create
    assert.deepEqual(
      await calculator.syncRatioRewardOrders(
        position,
        [new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 0.15, false, 'our_id', 'buy', 'limit')],
        { stop_percent: 0.5, target_percent: 0.25 }
      ),
      {
        stop: {
          amount: 0.15,
          price: 6534.2688
        }
      }
    );
  });

  it('update risk reward ratio changeset orders (short)', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    const position = new Position('BTCUSD', 'short', -0.15, 0, new Date(), 6501.76);
    const orders = [
      new ExchangeOrder(
        '12345-12345',
        undefined,
        undefined,
        6401.76,
        0.01,
        undefined,
        undefined,
        'sell',
        ExchangeOrder.TYPE_STOP
      ),
      new ExchangeOrder(
        '54321-54321',
        undefined,
        undefined,
        6601.76,
        0.9,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    ];

    const result = await calculator.syncRatioRewardOrders(position, orders, {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    assert.deepEqual(result.stop, { amount: 0.15, id: '12345-12345' });
    assert.deepEqual(result.target, { amount: 0.15, id: '54321-54321' });
  });

  it('create risk reward ratio orders (long)', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    const position = new Position('BTCUSD', 'long', 0.15, 0, new Date(), 6501.76);

    const orders = await calculator.createRiskRewardOrdersOrders(position, [], {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    const closeOrder = orders.find(order => order.type === 'target');
    assert.deepEqual(closeOrder.price, -6518.0144);

    const stopOrder = orders.find(order => order.type === 'stop');
    assert.deepEqual(stopOrder.price, -6469.251200000001);
  });

  it('create risk reward ratio orders (short)', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    const position = new Position('BTCUSD', 'short', -0.15, 0, new Date(), 6501.76);

    const orders = await calculator.createRiskRewardOrdersOrders(position, [], {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    const closeOrder = orders.find(order => order.type === 'target');
    assert.deepEqual(closeOrder.price, 6485.5056);

    const stopOrder = orders.find(order => order.type === 'stop');
    assert.deepEqual(stopOrder.price, 6534.2688);
  });

  it('create risk reward ratio orders updates for long', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);
    const position = new Position('BTCUSD', 'long', 0.15, 0, new Date(), 6501.76);

    const openExchangeOrders = [
      new ExchangeOrder(123, 'FOOUSD', 'open', 6500.76, 0.11, undefined, undefined, 'sell', ExchangeOrder.TYPE_STOP),
      new ExchangeOrder(321, 'FOOUSD', 'open', 6522.76, 0.11, undefined, undefined, 'sell', ExchangeOrder.TYPE_LIMIT)
    ];

    const orders = await calculator.createRiskRewardOrdersOrders(position, openExchangeOrders, {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    // stop should close
    const limitOrder = orders.find(order => order.id === 321);
    assert.strictEqual(limitOrder.id, 321);
    assert.strictEqual(limitOrder.amount, -0.15);

    // stop should close
    const stopOrder = orders.find(order => order.id === 123);
    assert.strictEqual(stopOrder.id, 123);
    assert.strictEqual(stopOrder.amount, -0.15);
  });

  it('create risk reward ratio orders updates for short', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);
    const position = new Position('BTCUSD', 'short', -0.15, 0, new Date(), 6501.76);

    const openExchangeOrders = [
      new ExchangeOrder(123, 'FOOUSD', 'open', 6500.76, 0.11, undefined, undefined, 'buy', ExchangeOrder.TYPE_LIMIT),
      new ExchangeOrder(321, 'FOOUSD', 'open', 6520.76, 0.11, undefined, undefined, 'buy', ExchangeOrder.TYPE_STOP)
    ];

    const orders = await calculator.createRiskRewardOrdersOrders(position, openExchangeOrders, {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    // stop should close
    const limitOrder = orders.find(order => order.id === 321);
    assert.strictEqual(limitOrder.id, 321);
    assert.strictEqual(limitOrder.amount, 0.15);

    // stop should close
    const stopOrder = orders.find(order => order.id === 123);
    assert.strictEqual(stopOrder.id, 123);
    assert.strictEqual(stopOrder.amount, 0.15);
  });

  it('test sync calucation for big different in long position', async () => {
    const calculator = new RiskRewardRatioCalculator(fakeLogger);

    const position = new Position('EOSUSD', 'long', 2, 0, new Date(), 3.2);
    const orders = [
      new ExchangeOrder('1', undefined, undefined, 6401.76, 4, undefined, undefined, 'sell', ExchangeOrder.TYPE_STOP),
      new ExchangeOrder('2', undefined, undefined, 6401.76, 4, undefined, undefined, 'sell', ExchangeOrder.TYPE_LIMIT)
    ];

    const result = await calculator.syncRatioRewardOrders(position, orders, {
      stop_percent: 0.5,
      target_percent: 0.25
    });

    assert.deepEqual(result.stop, { amount: -2, id: '1' });
    assert.deepEqual(result.target, { amount: -2, id: '2' });
  });
});
