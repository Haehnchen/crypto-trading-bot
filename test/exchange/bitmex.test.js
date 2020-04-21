const assert = require('assert');
const fs = require('fs');
const Bitmex = require('../../src/exchange/bitmex');
const Order = require('../../src/dict/order');

describe('#bitmex exchange implementation', function() {
  it('positions are extracted', () => {
    const pos = Bitmex.createPositionsWithOpenStateOnly(createResponse('ws-positions.json'));

    assert.equal(pos[0].symbol, 'LTCZ18');
    assert.equal(pos[0].side, 'short');
    assert.equal(pos[0].amount, -4);
    assert.equal(pos[0].profit, 0.12);
    assert.equal(pos[0].entry, 0.00832);

    assert.equal(pos[0].createdAt.toISOString(), '2018-10-19T17:00:00.000Z');
  });

  it('orders are extracted', () => {
    const orders = Bitmex.createOrders(createResponse('ws-orders.json'));

    assert.equal(orders[0].id, 'fb7972c4-b4fa-080f-c0b1-1919db50bc63');
    assert.equal(orders[0].symbol, 'LTCZ18');
    assert.equal(orders[0].side, 'sell');
    assert.equal(orders[0].amount, 2);
    assert.equal(orders[0].price, 0.00839);
    assert.equal(orders[0].retry, false);
    assert.equal(orders[0].type, 'limit');
    assert.equal(orders[0].createdAt.toISOString(), '2018-10-19T16:31:27.496Z');
    assert.equal(orders[0].updatedAt instanceof Date, true);
    assert.equal(orders[0].retry, false);
    assert.equal(orders[0].status, 'open');

    assert.equal(orders[2].price, 0.00852);
    assert.equal(orders[2].type, 'stop');
    assert.equal(orders[2].retry, false);

    assert.equal(orders[4].retry, false);
    assert.equal(orders[4].status, 'done');
  });

  it('orders retry trigger', () => {
    const orders = Bitmex.createOrders(createResponse('ws-orders.json'));

    assert.equal(orders[3].retry, true);
    assert.equal(orders[3].status, 'canceled');
  });

  it('calculate instrument rounding sizes', () => {
    const bitmex = new Bitmex();

    bitmex.lotSizes = {
      LTC: 1
    };

    bitmex.tickSizes = {
      LTC: 0.00001
    };

    assert.equal(bitmex.calculatePrice(0.0085696, 'LTC'), 0.00856);
    assert.equal(bitmex.calculateAmount(0.85, 'LTC'), 0);

    assert.equal(bitmex.calculatePrice(-0.0085696, 'LTC'), -0.00856);
    assert.equal(bitmex.calculateAmount(-0.85, 'LTC'), 0);
  });

  it('test that request body for order is created (limit order)', () => {
    const body = Bitmex.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'long', 1337, 0.5));
    body.clOrdID = 'foobar';

    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      orderQty: 0.5,
      ordType: 'Limit',
      text: 'Powered by your awesome crypto-bot watchdog',
      execInst: 'ParticipateDoNotInitiate',
      price: 1337,
      side: 'Buy',
      clOrdID: 'foobar'
    });
  });

  it('test that request body for order is created (limit order) [short]', () => {
    const body = Bitmex.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'short', -1337, 0.5));
    body.clOrdID = 'foobar';

    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      orderQty: 0.5,
      ordType: 'Limit',
      text: 'Powered by your awesome crypto-bot watchdog',
      execInst: 'ParticipateDoNotInitiate',
      price: 1337,
      side: 'Sell',
      clOrdID: 'foobar'
    });
  });

  it('test that request body for order is created (stop order)', () => {
    const body = Bitmex.createOrderBody(Order.createStopLossOrder('BTCUSD', 1337, 0.5));
    body.clOrdID = 'foobar';

    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      orderQty: 0.5,
      ordType: 'Stop',
      text: 'Powered by your awesome crypto-bot watchdog',
      execInst: 'Close,LastPrice',
      stopPx: 1337,
      side: 'Buy',
      clOrdID: 'foobar'
    });
  });

  it('test that request body for limit order to close is generated', () => {
    const body = Bitmex.createOrderBody(Order.createCloseOrderWithPriceAdjustment('BTCUSD', -1337));
    body.clOrdID = 'foobar';

    assert.equal(body.execInst, 'ReduceOnly,ParticipateDoNotInitiate');
  });

  it('test that request body for order is created (stop order) [short]', () => {
    const body = Bitmex.createOrderBody(Order.createStopLossOrder('BTCUSD', -1337, 0.5));
    body.clOrdID = 'foobar';

    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      orderQty: 0.5,
      ordType: 'Stop',
      text: 'Powered by your awesome crypto-bot watchdog',
      execInst: 'Close,LastPrice',
      stopPx: 1337,
      side: 'Sell',
      clOrdID: 'foobar'
    });
  });

  it('test position updates with workflow', async () => {
    const bitmex = new Bitmex(undefined, undefined);

    const positions = createResponse('ws-positions-updates.json');

    // init positions
    bitmex.fullPositionsUpdate(positions);
    assert.equal((await bitmex.getPositions()).length, 2);
    assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD');
    assert.equal((await bitmex.getPositionForSymbol('LTCZ18')).symbol, 'LTCZ18');
    assert.equal(await bitmex.getPositionForSymbol('FOOUSD'), undefined);

    // remove one item
    bitmex.fullPositionsUpdate(positions.slice().filter(position => position.symbol !== 'LTCZ18'));
    assert.equal((await bitmex.getPositions()).length, 1);
    assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD');
    assert.equal(await bitmex.getPositionForSymbol('LTCZ18'), undefined);
    assert.equal(await bitmex.getPositionForSymbol('FOOUSD'), undefined);

    // full update again
    bitmex.fullPositionsUpdate(positions);
    assert.equal((await bitmex.getPositions()).length, 2);

    // set LTCZ18 TO be closed; previous state was open
    const positions1 = positions.slice();
    positions1[0].isOpen = false;

    bitmex.fullPositionsUpdate(positions1);
    assert.equal((await bitmex.getPositions()).length, 1);
    assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD');
    assert.equal(await bitmex.getPositionForSymbol('LTCZ18'), undefined);
    assert.equal(await bitmex.getPositionForSymbol('FOOUSD'), undefined);
  });

  it('test position updates with delta workflow', async () => {
    const bitmex = new Bitmex(undefined, undefined);

    const positions = createResponse('ws-positions-updates.json');

    // init positions
    bitmex.deltaPositionsUpdate(positions);
    assert.equal((await bitmex.getPositions()).length, 2);
    assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD');
    assert.equal((await bitmex.getPositionForSymbol('LTCZ18')).symbol, 'LTCZ18');
    assert.equal(await bitmex.getPositionForSymbol('FOOUSD'), undefined);

    // remove one item; but must not be cleared
    bitmex.deltaPositionsUpdate(positions.slice().filter(position => position.symbol !== 'LTCZ18'));
    assert.equal((await bitmex.getPositions()).length, 2);
    assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD');
    assert.equal((await bitmex.getPositionForSymbol('LTCZ18')).symbol, 'LTCZ18');
    assert.equal(await bitmex.getPositionForSymbol('FOOUSD'), undefined);

    // set LTCZ18 TO be closed; previous state was open
    const positions1 = positions.slice();
    positions1[0].isOpen = false;

    bitmex.fullPositionsUpdate(positions1);
    assert.equal((await bitmex.getPositions()).length, 1);
    assert.equal((await bitmex.getPositionForSymbol('BTCUSD')).symbol, 'BTCUSD');
    assert.equal(await bitmex.getPositionForSymbol('LTCZ18'), undefined);
    assert.equal(await bitmex.getPositionForSymbol('FOOUSD'), undefined);
  });

  it('test update of order', async () => {
    const requestClient = {
      executeRequestRetry: options => {
        return new Promise(resolve => {
          myOptions = options;

          resolve({
            error: undefined,
            response: undefined,
            body: JSON.stringify(createResponse('ws-orders.json')[0])
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { info: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let myOptions;

    const order = await bitmex.updateOrder('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar', 'long'));

    assert.equal(myOptions.method, 'PUT');
    assert.equal(
      myOptions.body,
      '{"orderID":"0815foobar","text":"Powered by your awesome crypto-bot watchdog","price":null}'
    );
    assert.equal(myOptions.url, 'https://www.bitmex.com/api/v1/order');

    assert.equal(Object.keys(myOptions.headers).includes('api-expires'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-key'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-signature'), true);

    assert.equal(order.id, 'fb7972c4-b4fa-080f-c0b1-1919db50bc63');
    assert.equal(order.retry, false);

    assert.equal((await bitmex.getOrders()).length, 1);
    assert.equal(
      (await bitmex.findOrderById('fb7972c4-b4fa-080f-c0b1-1919db50bc63')).id,
      'fb7972c4-b4fa-080f-c0b1-1919db50bc63'
    );
  });

  it('test update of order with retry limit reached', async () => {
    const requestClient = {
      executeRequestRetry: () => {
        return new Promise(resolve => {
          resolve({
            error: undefined,
            response: undefined,
            body: JSON.stringify({
              error: {
                message: 'The system is currently overloaded. Please try again later.'
              }
            })
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { info: () => {}, error: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let err = 'foobar';
    try {
      await bitmex.updateOrder('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar', 'long'));
    } catch (e) {
      err = e;
    }

    assert.equal(err, undefined);
  });

  it('test update of order with retry limit reached with status code 503', async () => {
    const requestClient = {
      executeRequestRetry: () => {
        return new Promise(resolve => {
          resolve({
            error: undefined,
            response: { statusCode: 503 },
            body: undefined
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { info: () => {}, error: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let err = 'foobar';
    try {
      await bitmex.updateOrder('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar', 'long'));
    } catch (e) {
      err = e;
    }

    assert.equal(err, undefined);
  });

  it('test cancel of order', async () => {
    const requestClient = {
      executeRequestRetry: options => {
        return new Promise(resolve => {
          myOptions = options;

          resolve({
            error: undefined,
            response: undefined,
            body: JSON.stringify(createResponse('ws-orders.json'))
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { info: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let myOptions;

    const order = await bitmex.cancelOrder('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar', 'long'));

    assert.equal(myOptions.method, 'DELETE');
    assert.equal(myOptions.body, '{"orderID":"0815foobar","text":"Powered by your awesome crypto-bot watchdog"}');
    assert.equal(myOptions.url, 'https://www.bitmex.com/api/v1/order');

    assert.equal(Object.keys(myOptions.headers).includes('api-expires'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-key'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-signature'), true);

    assert.equal(order.id, 'fb7972c4-b4fa-080f-c0b1-1919db50bc63');
    assert.equal(order.retry, false);

    assert.equal((await bitmex.getOrders()).length, 3);
    assert.equal(
      (await bitmex.findOrderById('fb7972c4-b4fa-080f-c0b1-1919db50bc63')).id,
      'fb7972c4-b4fa-080f-c0b1-1919db50bc63'
    );
  });

  it('test cancel of all orders', async () => {
    const requestClient = {
      executeRequestRetry: options => {
        return new Promise(resolve => {
          myOptions = options;

          resolve({
            error: undefined,
            response: undefined,
            body: JSON.stringify(createResponse('ws-orders.json'))
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { info: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let myOptions;

    const orders = await bitmex.cancelAll('BTCUSD');

    assert.equal(myOptions.method, 'DELETE');
    assert.equal(myOptions.body, '{"symbol":"BTCUSD","text":"Powered by your awesome crypto-bot watchdog"}');
    assert.equal(myOptions.url, 'https://www.bitmex.com/api/v1/order/all');

    assert.equal(Object.keys(myOptions.headers).includes('api-expires'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-key'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-signature'), true);

    const order = orders.find(order => order.id === 'fb7972c4-b4fa-080f-c0b1-1919db50bc63');

    assert.equal(order.id, 'fb7972c4-b4fa-080f-c0b1-1919db50bc63');
    assert.equal(order.retry, false);

    assert.equal((await bitmex.getOrders()).length, 3);
    assert.equal(
      (await bitmex.findOrderById('fb7972c4-b4fa-080f-c0b1-1919db50bc63')).id,
      'fb7972c4-b4fa-080f-c0b1-1919db50bc63'
    );
  });

  it('test order creation fails', async () => {
    const requestClient = {
      executeRequestRetry: options => {
        return new Promise(resolve => {
          myOptions = options;

          resolve({
            error: undefined,
            response: undefined,
            body: JSON.stringify({ error: {} })
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { info: () => {}, error: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let myOptions;

    let result;
    try {
      result = await bitmex.order(Order.createMarketOrder('BTCUSD', 12));
    } catch (e) {}

    const body = JSON.parse(myOptions.body);
    delete body.clOrdID;

    assert.equal(myOptions.method, 'POST');
    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      orderQty: 12,
      ordType: 'Market',
      text: 'Powered by your awesome crypto-bot watchdog',
      side: 'Buy'
    });

    assert.equal(myOptions.url, 'https://www.bitmex.com/api/v1/order');

    assert.equal(Object.keys(myOptions.headers).includes('api-expires'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-key'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-signature'), true);

    assert.equal(result, undefined);
  });

  it('test that order response is provide', async () => {
    const requestClient = {
      executeRequestRetry: options => {
        return new Promise(resolve => {
          myOptions = options;

          resolve({
            error: undefined,
            response: undefined,
            body: JSON.stringify(createResponse('ws-orders.json')[0])
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { info: () => {}, error: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let myOptions;

    const order = await bitmex.order(Order.createMarketOrder('BTCUSD', 12));

    const body = JSON.parse(myOptions.body);
    delete body.clOrdID;

    assert.equal(myOptions.method, 'POST');
    assert.deepEqual(body, {
      symbol: 'BTCUSD',
      orderQty: 12,
      ordType: 'Market',
      text: 'Powered by your awesome crypto-bot watchdog',
      side: 'Buy'
    });

    assert.equal(myOptions.url, 'https://www.bitmex.com/api/v1/order');

    assert.equal(Object.keys(myOptions.headers).includes('api-expires'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-key'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-signature'), true);

    assert.equal('limit', order.type);
    assert.equal('sell', order.side);
    assert.equal('fb7972c4-b4fa-080f-c0b1-1919db50bc63', order.raw.orderID);

    assert.equal((await bitmex.getOrders()).length, 1);
    assert.equal(
      (await bitmex.findOrderById('fb7972c4-b4fa-080f-c0b1-1919db50bc63')).id,
      'fb7972c4-b4fa-080f-c0b1-1919db50bc63'
    );
  });

  it('test full order update via api', async () => {
    const requestClient = {
      executeRequestRetry: options => {
        return new Promise(resolve => {
          myOptions = options;

          resolve({
            error: undefined,
            response: { statusCode: 200 },
            body: JSON.stringify(createResponse('ws-orders.json'))
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { debug: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let myOptions;

    await bitmex.syncOrdersViaRestApi('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar', 'long'));

    const orders = await bitmex.getOrders();

    assert.equal(myOptions.method, 'GET');
    assert.equal(myOptions.url, 'https://www.bitmex.com/api/v1/order?filter=%7B%22open%22%3Atrue%7D');

    assert.equal(Object.keys(myOptions.headers).includes('api-expires'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-key'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-signature'), true);

    const order = orders.find(order => order.id === 'fb7972c4-b4fa-080f-c0b1-1919db50bc63');

    assert.equal(order.id, 'fb7972c4-b4fa-080f-c0b1-1919db50bc63');
    assert.equal(order.retry, false);

    assert.equal((await bitmex.getOrders()).length, 3);
    assert.equal(
      (await bitmex.findOrderById('fb7972c4-b4fa-080f-c0b1-1919db50bc63')).id,
      'fb7972c4-b4fa-080f-c0b1-1919db50bc63'
    );
    assert.equal(
      (await bitmex.getOrdersForSymbol('LTCZ18')).find(order => order.id === 'fb7972c4-b4fa-080f-c0b1-1919db50bc63').id,
      'fb7972c4-b4fa-080f-c0b1-1919db50bc63'
    );
  });

  it('test full position update via api', async () => {
    const requestClient = {
      executeRequestRetry: options => {
        return new Promise(resolve => {
          myOptions = options;

          resolve({
            error: undefined,
            response: { statusCode: 200 },
            body: JSON.stringify(createResponse('ws-positions.json'))
          });
        });
      }
    };

    const bitmex = new Bitmex(undefined, requestClient, undefined, { debug: () => {} });

    bitmex.apiKey = 'my_key';
    bitmex.apiSecret = 'my_secret';
    bitmex.retryOverloadMs = 10;

    let myOptions;

    await bitmex.syncPositionViaRestApi('0815foobar', Order.createPriceUpdateOrder('0815foobar', 'foobar', 'long'));

    const positions = await bitmex.getPositions();

    assert.equal(myOptions.method, 'GET');
    assert.equal(myOptions.url, 'https://www.bitmex.com/api/v1/position');

    assert.equal(Object.keys(myOptions.headers).includes('api-expires'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-key'), true);
    assert.equal(Object.keys(myOptions.headers).includes('api-signature'), true);

    assert.equal(positions.filter(p => p.symbol === 'LTCZ18').length, 1);
  });

  let createResponse = filename => {
    return JSON.parse(fs.readFileSync(`${__dirname}/bitmex/${filename}`, 'utf8'));
  };
});
