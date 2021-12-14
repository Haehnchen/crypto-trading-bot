const assert = require('assert');
const { Position, Order } = require('bfx-api-node-models');
const fs = require('fs');
const Bitfinex = require('../../src/exchange/bitfinex');
const OurOrder = require('../../src/dict/order');
const ExchangeOrder = require('../../src/dict/exchange_order');
const Ticker = require('../../src/dict/ticker');

const createResponse = function(filename) {
  const response = JSON.parse(fs.readFileSync(`${__dirname}/bitfinex/${filename}`, 'utf8')).map(
    item => Object.assign(item, { _fieldKeys: ['status'] }) // fake magic object of lib
  );
  return response;
};

describe('#bitfinex exchange implementation', function() {
  it('positions are extracted', () => {
    const pos = Bitfinex.createPositions(
      createResponse('on-ps.json').map(r => {
        return Position.unserialize(r);
      })
    );

    assert.equal('IOTUSD', pos[0].symbol);
    assert.equal('short', pos[0].side);
    assert.equal(-80, pos[0].amount);

    assert.equal('IOTUSD', pos[1].symbol);
    assert.equal('long', pos[1].side);
    assert.equal(80, pos[1].amount);
    assert.equal(pos[1].updatedAt instanceof Date, true);
    assert.equal(pos[1].createdAt instanceof Date, true);
  });

  it('orders are extracted', () => {
    const orders = Bitfinex.createExchangeOrders(createResponse('on-orders.json'));

    assert.equal(orders[0].id, '18233985719');
    assert.equal(orders[0].symbol, 'BCHBTC');
    assert.equal(orders[0].status, 'open');

    assert.equal(orders[0].price, 0.067);
    assert.equal(orders[0].amount, 0.2);
    assert.equal(orders[0].retry, false);
    assert.equal(orders[0].ourId, '70300865307');
    assert.equal(orders[0].type, 'limit');
    assert.equal(orders[0].createdAt.toISOString(), '2018-10-19T19:31:40.939Z');
    assert.equal(orders[0].updatedAt instanceof Date, true);

    assert.equal(orders[0].raw.status, 'ACTIVE');
  });

  it('test calculate amount', async () => {
    // Amount Precision // https://docs.bitfinex.com/docs#amount-precision
    // The amount field allows up to 8 decimals. Anything exceeding this will be rounded to the 8th decimal.
    const bitfinex = new Bitfinex(
      {},
      {
        debug: () => {}
      },
      {}
    );

    assert.equal(bitfinex.calculateAmount(1234.5678912, 'BTC'), 1234.5678912);
    assert.equal(bitfinex.calculateAmount(1.2345678912, 'LTC'), 1.2345678912);
    assert.equal(bitfinex.calculateAmount(0.00012345678912345, 'FOOBAR'), 0.00012345678912345);
  });

  it('test calculate price', async () => {
    // Price Precision https://docs.bitfinex.com/docs#price-precision
    // The precision level of all trading prices is based on significant figures. All pairs on Bitfinex use up to 5 significant digits and up to 8 decimals (e.g. 1.2345, 123.45, 1234.5, 0.00012345). Prices submit with a precision larger than 5 will be cut by the API.
    // No need to round on take actions client side
    const bitfinex = new Bitfinex(
      {},
      {
        debug: () => {}
      },
      {}
    );

    assert.equal(bitfinex.calculatePrice(1234.5678912, 'BTC'), 1234.5678912);
    assert.equal(bitfinex.calculatePrice(1.2345678912, 'LTC'), 1.2345678912);
    assert.equal(bitfinex.calculatePrice(0.00010203451, 'FOOBAR'), 0.00010203451);
  });

  it('test find positions', async () => {
    const bitfinex = new Bitfinex();

    bitfinex.tickers.BTCUSD = new Ticker('foobar', 'BTCUSD', undefined, 13.12, 13.13);

    bitfinex.onPositionUpdate(Position.unserialize(['tBTCUSD', 'ACTIVE', 0.1, 12.12]));
    bitfinex.onPositionUpdate(Position.unserialize(['tLTCUSD', 'CLOSED', 0.1, 12.12]));

    const position = await bitfinex.getPositionForSymbol('BTCUSD');
    delete position.updatedAt;
    delete position.createdAt;
    assert.deepEqual(position, {
      amount: 0.1,
      entry: 12.12,
      profit: undefined,
      raw: undefined,
      side: 'long',
      symbol: 'BTCUSD'
    });
  });

  it('test that order options are created (short)', async () => {
    const actual = Bitfinex.createOrder(OurOrder.createLimitPostOnlyOrderAutoSide('BTCUSD', -1337.12, -10)).toPreview();
    delete actual.cid;

    assert.deepEqual(actual, {
      amount: -10,
      flags: 4096,
      gid: undefined,
      notify: undefined,
      price: '1337.12',
      symbol: 'tBTCUSD',
      type: 'LIMIT'
    });
  });

  it('test that order options are created (long)', async () => {
    const actual = Bitfinex.createOrder(OurOrder.createLimitPostOnlyOrderAutoSide('BTCUSD', 1337.12, 10)).toPreview();
    delete actual.cid;

    assert.deepEqual(actual, {
      amount: 10,
      flags: 4096,
      gid: undefined,
      notify: undefined,
      price: '1337.12',
      symbol: 'tBTCUSD',
      type: 'LIMIT'
    });
  });

  it('test that order options are created (stop long)', async () => {
    const actual = Bitfinex.createOrder(OurOrder.createStopLossOrder('BTCUSD', 1337.12, 10)).toPreview();
    delete actual.cid;

    assert.deepEqual(actual, {
      amount: 10,
      flags: 1024,
      gid: undefined,
      notify: undefined,
      price: '1337.12',
      symbol: 'tBTCUSD',
      type: 'STOP'
    });
  });

  it('test that order options are created (stop short)', async () => {
    const actual = Bitfinex.createOrder(OurOrder.createStopLossOrder('BTCUSD', -1337.12, -10)).toPreview();
    delete actual.cid;

    assert.deepEqual(actual, {
      amount: -10,
      flags: 1024,
      gid: undefined,
      notify: undefined,
      price: '1337.12',
      symbol: 'tBTCUSD',
      type: 'STOP'
    });
  });

  it('test that order options are created (market long)', async () => {
    const actual = Bitfinex.createOrder(OurOrder.createMarketOrder('BTCUSD', 10)).toPreview();
    delete actual.cid;

    assert.deepEqual(actual, {
      amount: 10,
      flags: 0,
      gid: undefined,
      notify: undefined,
      price: undefined,
      symbol: 'tBTCUSD',
      type: 'MARKET'
    });
  });

  it('test that order options are created (market short)', async () => {
    const actual = Bitfinex.createOrder(OurOrder.createMarketOrder('BTCUSD', -10)).toPreview();
    delete actual.cid;

    assert.deepEqual(actual, {
      amount: -10,
      flags: 0,
      gid: undefined,
      notify: undefined,
      price: undefined,
      symbol: 'tBTCUSD',
      type: 'MARKET'
    });
  });

  it('test that order options are created (stop loss short)', async () => {
    const actual = Bitfinex.createOrder(OurOrder.createStopLossOrder('BTCUSD', -10, -2)).toPreview();
    delete actual.cid;

    assert.deepEqual(actual, {
      amount: -2,
      flags: 1024,
      gid: undefined,
      notify: undefined,
      price: '10',
      symbol: 'tBTCUSD',
      type: 'STOP'
    });
  });

  it('test that order options are created (stop loss long)', async () => {
    const actual = Bitfinex.createOrder(OurOrder.createStopLossOrder('BTCUSD', 10, 2)).toPreview();
    delete actual.cid;

    assert.deepEqual(actual, {
      amount: 2,
      flags: 1024,
      gid: undefined,
      notify: undefined,
      price: '10',
      symbol: 'tBTCUSD',
      type: 'STOP'
    });
  });

  it('test position events (long)', async () => {
    const bitfinex = new Bitfinex();

    bitfinex.tickers.BTCUSD = new Ticker('foobar', 'BTCUSD', undefined, 13.12, 13.13);

    bitfinex.onPositionUpdate(Position.unserialize(['tBTCUSD', 'ACTIVE', 0.1, 12.12]));

    bitfinex.onPositionUpdate(Position.unserialize(['tLTCUSD', 'CLOSED', 0.1, 12.12]));

    const positions = await bitfinex.getPositions();

    assert.equal(positions.find(p => p.symbol === 'BTCUSD').symbol, 'BTCUSD');
    assert.equal(positions.find(p => p.symbol === 'BTCUSD').profit.toFixed(2), 8.25);
    assert.equal(positions.filter(p => p.symbol === 'LTCUSD').length, 0);
  });

  it('test position events (short)', async () => {
    const bitfinex = new Bitfinex();

    bitfinex.tickers.BTCUSD = new Ticker('foobar', 'BTCUSD', undefined, 13.12, 13.13);

    bitfinex.onPositionUpdate(Position.unserialize(['tBTCUSD', 'ACTIVE', -0.1, 12.12]));

    const positions = await bitfinex.getPositions();

    assert.equal(positions.find(p => p.symbol === 'BTCUSD').symbol, 'BTCUSD');
    assert.equal(positions.find(p => p.symbol === 'BTCUSD').profit.toFixed(2), -7.69);
    assert.equal(positions.filter(p => p.symbol === 'LTCUSD').length, 0);
  });

  it('test position events (closing)', async () => {
    const bitfinex = new Bitfinex();

    bitfinex.onPositionUpdate(Position.unserialize(['tBTCUSD', 'ACTIVE', 12.12]));

    assert.equal(Object.keys(bitfinex.positions).includes('BTCUSD'), true);
    assert.equal((await bitfinex.getPositions()).filter(p => p.symbol === 'BTCUSD').length, 1);

    bitfinex.onPositionUpdate(Position.unserialize(['tBTCUSD', 'CLOSED', 12.12]));

    assert.equal(Object.keys(bitfinex.positions).includes('BTCUSD'), false);
    assert.equal((await bitfinex.getPositions()).filter(p => p.symbol === 'BTCUSD').length, 0);
  });

  it('test full position events (closing)', async () => {
    const bitfinex = new Bitfinex();

    bitfinex.onPositions([
      Position.unserialize(['tBTCUSD', 'ACTIVE', 12.12]),
      Position.unserialize(['tLTCUSD', 'CLOSED', 12.12])
    ]);

    assert.deepEqual(Object.keys(bitfinex.positions), ['BTCUSD']);
    assert.equal((await bitfinex.getPositions()).filter(p => p.symbol === 'BTCUSD').length, 1);
    assert.equal((await bitfinex.getPositions()).filter(p => p.symbol === 'LTCUSD').length, 0);

    bitfinex.onPositionUpdate(Position.unserialize(['tBTCUSD', 'CLOSED', 12.12]));

    assert.deepEqual(Object.keys(bitfinex.positions), []);
    assert.equal((await bitfinex.getPositions()).length, 0);
  });

  it('test order updates', async () => {
    const bitfinex = new Bitfinex({}, { info: () => {} }, {});

    bitfinex.onOrderUpdate(
      Order.unserialize([
        999911111000,
        1,
        undefined,
        'tBTCUSD',
        undefined,
        undefined,
        undefined,
        undefined,
        'LIMIT',
        undefined,
        undefined,
        undefined,
        undefined,
        'ACTIVE'
      ])
    );

    assert.deepEqual(Object.keys(bitfinex.orders), ['999911111000']);
    assert.equal((await bitfinex.getOrders()).filter(p => p.symbol === 'BTCUSD').length, 1);

    bitfinex.onOrderUpdate(
      Order.unserialize([
        999911111000,
        1,
        undefined,
        'tBTCUSD',
        undefined,
        undefined,
        undefined,
        undefined,
        'LIMIT',
        undefined,
        undefined,
        undefined,
        undefined,
        'EXECUTED'
      ])
    );

    assert.deepEqual(Object.keys(bitfinex.orders), ['999911111000']);
    assert.equal((await bitfinex.getOrders()).filter(p => p.symbol === 'BTCUSD').length, 0);
  });

  it('test that order is updated for long', async () => {
    const fixturesOrders = Bitfinex.createExchangeOrders(createResponse('on-orders.json'));

    const bitfinex = new Bitfinex();

    let myChanges;
    bitfinex.client = {
      updateOrder: async changes => {
        myChanges = changes;
        return fixturesOrders[0];
      }
    };

    const exchangeOrder = await bitfinex.updateOrder(12345, OurOrder.createUpdateOrder(121212, 12, 0.001));

    assert.strictEqual(exchangeOrder.symbol, 'BCHBTC');
    assert.deepStrictEqual(myChanges, { id: 12345, price: '12', amount: '0.001' });
  });

  it('test that order is updated for short', async () => {
    const fixturesOrders = Bitfinex.createExchangeOrders(createResponse('on-orders.json'));

    const bitfinex = new Bitfinex();

    let myChanges;
    bitfinex.client = {
      updateOrder: async changes => {
        myChanges = changes;
        return fixturesOrders[0];
      }
    };

    bitfinex.orders = {
      12345: new ExchangeOrder(
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
    };

    const exchangeOrder = await bitfinex.updateOrder(12345, OurOrder.createUpdateOrder(12345, -12, -0.001));

    assert.strictEqual(exchangeOrder.symbol, 'BCHBTC');
    assert.deepStrictEqual(myChanges, { id: 12345, price: '12', amount: '-0.001' });
  });

  it('test orders are canceled', async () => {
    const bitfinex = new Bitfinex();

    bitfinex.orders = {
      25035356: new ExchangeOrder(
        25035356,
        'FOOUSD',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      55555: new ExchangeOrder(
        '55555',
        'FOOUSD',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    };

    const cancelIds = [];
    bitfinex.client = {
      cancelOrder: async id => {
        cancelIds.push(id);
        return undefined;
      }
    };

    const exchangeOrder = await bitfinex.cancelAll('FOOUSD');

    assert.strictEqual(exchangeOrder.find(o => o.id === 25035356).id, 25035356);
    assert.strictEqual(exchangeOrder.find(o => o.id === '55555').id, '55555');

    assert.strictEqual(Object.keys(bitfinex.orders).length, 0);

    assert.strictEqual(cancelIds.includes(25035356), true);
    assert.strictEqual(cancelIds.includes(55555), true);
  });

  it('test cancel order is already canceled', async () => {
    const bitfinex = new Bitfinex(
      {},
      {
        error: () => {},
        info: () => {}
      }
    );

    bitfinex.orders = {
      55555: new ExchangeOrder(
        '55555',
        'FOOUSD',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    };

    bitfinex.client = {
      cancelOrder: async () => {
        throw new Error('Order not found');
      }
    };

    assert.strictEqual(1, (await bitfinex.getOrdersForSymbol('FOOUSD')).length);

    const order = await bitfinex.cancelOrder('55555');

    assert.strictEqual('55555', order.id);
    assert.strictEqual('canceled', order.status);

    assert.strictEqual(0, (await bitfinex.getOrdersForSymbol('FOOUSD')).length);
  });

  it('test orders that a single order can be canceled', async () => {
    const bitfinex = new Bitfinex();

    bitfinex.orders = {
      25035356: new ExchangeOrder(
        25035356,
        'FOOUSD',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      55555: new ExchangeOrder(
        55555,
        'FOOUSD',
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    };

    const cancelIds = [];
    bitfinex.client = {
      cancelOrder: async id => {
        cancelIds.push(id);
        return undefined;
      }
    };

    await bitfinex.cancelOrder(55555);
    assert.strictEqual(cancelIds.includes(55555), true);

    await bitfinex.cancelOrder('25035356');
    assert.strictEqual(cancelIds.includes(25035356), true);
  });
});
