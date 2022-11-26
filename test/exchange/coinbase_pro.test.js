const assert = require('assert');
const CoinbasePro = require('../../src/exchange/coinbase_pro');
const Ticker = require('../../src/dict/ticker');
const Order = require('../../src/dict/order');

describe('#coinbase pro exchange implementation', function() {
  it('profits are calculated', () => {
    const fills = [
      {
        created_at: '2019-06-27T12:20:30.319Z',
        product_id: 'LTC-EUR',
        price: '101.50000000',
        size: '1.00000000',
        fee: '3.1522500000000000',
        side: 'buy'
      },
      {
        created_at: '2019-06-27T09:10:16.86Z',
        price: '96.38000000',
        size: '4.00000000',
        fee: '3.5782800000000000',
        side: 'buy'
      },
      {
        created_at: '2019-04-26T20:58:21.274Z',
        price: '63.30000000',
        size: '1.41362565',
        fee: '10.1342237554675000',
        side: 'sell'
      }
    ];

    const result = CoinbasePro.calculateEntryOnFills(fills, 5);

    assert.equal(result.average_price.toFixed(2), 98.75);
    assert.equal(result.created_at.includes('2019'), true);
    assert.equal(result.size, 5);
  });

  it('profits are calculated with out of time range for fills', () => {
    const fills = [
      {
        created_at: '2019-06-27T12:20:30.319Z',
        product_id: 'LTC-EUR',
        price: '101.50000000',
        size: '1.00000000',
        fee: '0.1522500000000000',
        side: 'buy'
      },
      {
        created_at: '2019-06-11T09:10:16.86Z',
        price: '16.38000000',
        size: '4.00000000',
        fee: '3.5782800000000000',
        side: 'buy'
      }
    ];

    const result = CoinbasePro.calculateEntryOnFills(fills, 5);

    assert.equal(result.average_price.toFixed(2), 101.65);
    assert.equal(result.created_at.includes('2019'), true);
    assert.equal(result.size, 1);
  });

  it('positions are given', async () => {
    const coinbase = new CoinbasePro();

    coinbase.symbols = [
      {
        symbol: 'LTC-EUR',
        trade: {
          capital: 5
        }
      }
    ];

    coinbase.balances = [
      {
        balance: 5,
        currency: 'LTC-EUR'
      }
    ];

    coinbase.tickers['LTC-EUR'] = new Ticker('coinbase', 'LTC-EUR', 1000000, 141, 142);

    coinbase.fills['LTC-EUR'] = [
      {
        created_at: '2019-06-27T12:20:30.319Z',
        product_id: 'LTC-EUR',
        price: '101.50000000',
        size: '1.00000000',
        fee: '0.1522500000000000',
        side: 'buy'
      },
      {
        created_at: '2019-06-27T09:10:16.86Z',
        price: '96.38000000',
        size: '4.00000000',
        fee: '0.5782800000000000',
        side: 'buy'
      },
      {
        created_at: '2019-04-26T20:58:21.274Z',
        price: '63.30000000',
        size: '1.41362565',
        fee: '0.1342237554675000',
        side: 'sell'
      }
    ];

    const positions = await coinbase.getPositions();

    assert.equal(positions[0].amount, 5);
    assert.equal(positions[0].side, 'long');
    assert.equal(positions[0].symbol, 'LTC-EUR');
    assert.equal(positions[0].entry.toFixed(2), 97.55);
    assert.equal(positions[0].profit.toFixed(0), 45);
    assert.equal(positions[0].createdAt instanceof Date, true);
  });

  it('test placing order', async () => {
    const coinbasePro = new CoinbasePro(undefined, {
      error: () => {}
    });

    coinbasePro.client = {
      placeOrder: async () => {
        return {
          status: 'open',
          type: 'limit',
          side: 'buy',
          product_id: 'FOOBAR'
        };
      }
    };

    const order = await coinbasePro.order(Order.createMarketOrder('FOOBAR', 12));

    assert.strictEqual(order.retry, false);
    assert.strictEqual(order.status, 'open');
    assert.strictEqual(order.symbol, 'FOOBAR');
    assert.strictEqual(order.type, 'limit');
  });

  it('test placing order issues with rejection', async () => {
    const coinbasePro = new CoinbasePro(undefined, {
      error: () => {}
    });

    coinbasePro.client = {
      placeOrder: async () => {
        throw new Error('HTTP 400 Error: foobar');
      }
    };

    const order = await coinbasePro.order(Order.createMarketOrder('FOOBAR', 12));

    assert.strictEqual(order.retry, false);
    assert.strictEqual(order.status, 'rejected');
    assert.strictEqual(order.symbol, 'FOOBAR');
    assert.strictEqual(order.amount, 12);
    assert.strictEqual(order.type, 'market');
  });

  it('test placing order issues with rejection based on text', async () => {
    const coinbasePro = new CoinbasePro(undefined, {
      error: () => {}
    });

    coinbasePro.client = {
      placeOrder: async () => {
        throw new Error('HTTP 4xxx Error: size is too accurate');
      }
    };

    const order = await coinbasePro.order(Order.createMarketOrder('FOOBAR', 12));

    assert.strictEqual(order.retry, false);
    assert.strictEqual(order.status, 'rejected');
    assert.strictEqual(order.symbol, 'FOOBAR');
    assert.strictEqual(order.amount, 12);
    assert.strictEqual(order.type, 'market');
  });
});
