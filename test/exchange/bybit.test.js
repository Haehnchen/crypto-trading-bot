const assert = require('assert');
const fs = require('fs');
const Bybit = require('../../src/exchange/bybit');
const Order = require('../../src/dict/order');

describe('#bitmex exchange implementation', function() {
  it('positions are extracted', () => {
    const positions = Bybit.createPositionsWithOpenStateOnly(createResponse('ws-positions.json'));

    assert.equal(positions[0].symbol, 'BTCUSD');
    assert.equal(positions[0].side, 'long');
    assert.equal(positions[0].amount, 1);
    assert.equal(positions[0].profit, undefined);
    assert.equal(positions[0].entry.toFixed(2), 7898.89);

    assert.equal(positions[1].symbol, 'EOSUSD');
    assert.equal(positions[1].side, 'short');
    assert.equal(positions[1].amount.toFixed(2), -10);
    assert.equal(positions[1].entry.toFixed(2), 6.39);
  });

  it('orders are extracted', () => {
    const orders = Bybit.createOrders(createResponse('ws-orders.json'));

    assert.equal(orders[0].id, '5724145d-cc4e-4efc-a085-c8e8a342a279');
    assert.equal(orders[0].symbol, 'BTCUSD');
    assert.equal(orders[0].side, 'buy');
    assert.equal(orders[0].amount, 1);
    assert.equal(orders[0].price, 7898.5);
    assert.equal(orders[0].retry, false);
    assert.equal(orders[0].type, 'limit');
    assert.equal(orders[0].createdAt.toISOString(), '2019-06-09T11:06:21.000Z');
    assert.equal(orders[0].updatedAt instanceof Date, true);
    assert.equal(orders[0].retry, false);
    assert.equal(orders[0].status, 'open');

    assert.equal(orders[1].type, 'limit');
    assert.equal(orders[1].status, 'done');

    assert.equal(orders[2].id, '04463f4c-5021-443f-a794-e67e2a54a4bd');
    assert.equal(orders[2].type, 'stop');
    assert.equal(orders[2].status, 'open');

    assert.equal(orders[3].type, 'stop_limit');

    assert.equal(orders[4].status, 'open');
    assert.equal(orders[4].type, 'stop');

    assert.equal(orders[5].status, 'canceled');
    assert.equal(orders[5].type, 'stop');

    assert.equal(orders[6].type, 'stop');
    assert.equal(orders[6].price, 11020);

    assert.equal(orders[7].type, 'stop_limit');
    assert.equal(orders[7].price, 11081.5);

    assert.equal(orders[8].type, 'stop');
    assert.equal(orders[8].price, 2.593);

    assert.equal(orders[9].type, 'stop');
    assert.equal(orders[9].price, 10465);
  });

  it('test that request body for order is created (limit order)', () => {
    const body = Bybit.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'long', 1337, 0.5));
    body.order_link_id = 'foobar';

    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      qty: 0.5,
      order_type: 'Limit',
      price: 1337,
      side: 'Buy',
      order_link_id: 'foobar',
      time_in_force: 'PostOnly'
    });
  });

  it('test that request body for order is created (limit order) [short]', () => {
    const body = Bybit.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'short', -1337, 0.5));
    body.order_link_id = 'foobar';

    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      qty: 0.5,
      order_type: 'Limit',
      price: 1337,
      side: 'Sell',
      order_link_id: 'foobar',
      time_in_force: 'PostOnly'
    });
  });

  it('test that request body for order is created (stop order)', () => {
    const body = Bybit.createOrderBody(Order.createStopLossOrder('BTCUSD', 1337, 0.5));
    body.order_link_id = 'foobar';

    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      qty: 0.5,
      order_type: 'Market',
      close_on_trigger: true,
      stop_px: 1337,
      side: 'Buy',
      order_link_id: 'foobar',
      time_in_force: 'GoodTillCancel'
    });
  });

  it('test that order response is provided', async () => {
    const myOptions = [];

    const calls = [
      {
        error: undefined,
        response: { statusCode: 200 },
        body: JSON.stringify({ result: createResponse('ws-orders.json')[0] })
      },
      {
        error: undefined,
        response: { statusCode: 200 },
        body: JSON.stringify({ result: { data: createResponse('ws-orders.json') } })
      }
    ];

    let currentCall = 0;
    const requestClient = {
      executeRequestRetry: async options => {
        myOptions.push(options);
        return calls[currentCall++];
      }
    };

    const bybit = new Bybit(undefined, requestClient, undefined, { info: () => {}, error: () => {} });

    bybit.apiKey = 'my_key';
    bybit.apiSecret = 'my_secret';

    const order = await bybit.order(Order.createMarketOrder('BTCUSD', 12));

    assert.strictEqual(myOptions[0].method, 'POST');
    assert.strictEqual(true, myOptions[0].body.includes('timestamp'));
    assert.strictEqual(true, myOptions[0].body.includes('sign'));

    assert.strictEqual(myOptions[1].method, 'GET');
    assert.strictEqual(true, myOptions[1].url.includes('/v2/private/order/list?'));
    assert.strictEqual(true, myOptions[1].url.includes('&symbol=BTCUSD'));
    assert.strictEqual(true, myOptions[1].url.includes('&timestamp'));
    assert.strictEqual(true, myOptions[1].url.includes('&sign'));

    assert.strictEqual(order.type, 'limit');
    assert.strictEqual(order.side, 'buy');
    assert.strictEqual(order.raw.order_id, '5724145d-cc4e-4efc-a085-c8e8a342a279');

    assert.equal((await bybit.getOrders()).length, 1);
    assert.equal(
      (await bybit.findOrderById('5724145d-cc4e-4efc-a085-c8e8a342a279')).id,
      '5724145d-cc4e-4efc-a085-c8e8a342a279'
    );
  });

  let createResponse = filename => {
    return JSON.parse(fs.readFileSync(`${__dirname}/bybit/${filename}`, 'utf8'));
  };
});
