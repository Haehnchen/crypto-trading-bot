const assert = require('assert');
const fs = require('fs');
const Binance = require('../../src/exchange/binance');
const Order = require('../../src/dict/order');
const Position = require('../../src/dict/position');
const Ticker = require('../../src/dict/ticker');
const ExchangeOrder = require('../../src/dict/exchange_order');

describe('#binance exchange implementation', function() {
  it('limit order is created', () => {
    const orders = Binance.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'long', 1337, 0.5));

    delete orders.newClientOrderId;

    assert.deepEqual(
      {
        symbol: 'BTCUSD',
        quantity: 0.5,
        side: 'BUY',
        price: 1337,
        type: 'LIMIT'
      },
      orders
    );
  });

  it('limit order is created for negative values', () => {
    const orders = Binance.createOrderBody(Order.createLimitPostOnlyOrder('BTCUSD', 'short', 1337, -0.5));

    delete orders.newClientOrderId;

    assert.deepEqual(
      {
        symbol: 'BTCUSD',
        quantity: 0.5,
        side: 'SELL',
        price: 1337,
        type: 'LIMIT'
      },
      orders
    );
  });

  it('market order is created', () => {
    const orders = Binance.createOrderBody(Order.createMarketOrder('BTCUSD', -1337));

    delete orders.newClientOrderId;

    assert.deepEqual(
      {
        quantity: 1337,
        side: 'SELL',
        symbol: 'BTCUSD',
        type: 'MARKET'
      },
      orders
    );
  });

  it('stop order is created', () => {
    const orders = Binance.createOrderBody(Order.createStopLossOrder('BTCUSD', -1337, 12));

    delete orders.newClientOrderId;

    assert.deepEqual(
      {
        stopPrice: 1337,
        quantity: 12,
        side: 'SELL',
        symbol: 'BTCUSD',
        type: 'STOP_LOSS'
      },
      orders
    );
  });

  it('order creation', async () => {
    const binance = new Binance();
    binance.client = {
      order: () => {
        return new Promise(resolve => {
          resolve({
            symbol: 'XLMETH',
            orderId: 1740797,
            clientOrderId: '1XZTVBTGS4K1e',
            transactTime: 1514418413947,
            price: '0.00020000',
            origQty: '100.10000000',
            executedQty: '0.00000000',
            status: 'NEW',
            timeInForce: 'GTC',
            type: 'LIMIT',
            side: 'BUY'
          });
        });
      }
    };

    assert.equal(0, (await binance.getOrders()).length);

    const order = await binance.order(Order.createStopLossOrder('BTCUSD', -1337, 12));

    assert.equal(1740797, order.id);
    assert.equal('XLMETH', order.symbol);
    assert.equal('open', order.status);
    assert.equal('0.00020000', order.price);
    assert.equal(100.1, order.amount);
    assert.equal(false, order.retry);
    assert.equal('1XZTVBTGS4K1e', order.ourId);
    assert.equal('buy', order.side);
    assert.equal('limit', order.type);
    assert.equal('0.00000000', order.raw.executedQty);

    assert.equal(1, (await binance.getOrders()).length);
    assert.equal(1, (await binance.getOrdersForSymbol('XLMETH')).length);
    assert.equal(0, (await binance.getOrdersForSymbol('FOOBAR')).length);

    assert.equal('1XZTVBTGS4K1e', (await binance.findOrderById(1740797)).ourId);
  });

  it('order creation cases', async () => {
    const binance = new Binance();
    binance.client = {
      order: () => {
        return new Promise(resolve => {
          resolve({
            symbol: 'XLMETH',
            orderId: 1740797,
            clientOrderId: '1XZTVBTGS4K1e',
            transactTime: 1514418413947,
            price: '0.00020000',
            origQty: '100.10000000',
            executedQty: '0.00000000',
            status: 'PARTIALLY_FILLED',
            timeInForce: 'GTC',
            type: 'STOP_LOSS',
            side: 'SELL'
          });
        });
      }
    };

    const order = await binance.order(Order.createStopLossOrder('BTCUSD', -1337, 12));

    assert.equal('open', order.status);
    assert.equal('sell', order.side);
    assert.equal('stop', order.type);
    assert.equal(true, order.createdAt instanceof Date);
    assert.equal(true, order.updatedAt instanceof Date);
  });

  it('order cancel order', async () => {
    const binance = new Binance();
    binance.client = {
      order: () => {
        return new Promise(resolve => {
          resolve({
            symbol: 'BTCUSD',
            orderId: 1740797,
            clientOrderId: '1XZTVBTGS4K1e',
            transactTime: 1514418413947,
            price: '0.00020000',
            origQty: '100.10000000',
            executedQty: '0.00000000',
            status: 'PARTIALLY_FILLED',
            timeInForce: 'GTC',
            type: 'STOP_LOSS',
            side: 'SELL'
          });
        });
      },
      cancelOrder: () => {
        return new Promise(resolve => {
          resolve({
            symbol: 'BTCUSD',
            origClientOrderId: '1XZTVBTGS4K1e',
            orderId: 1740797,
            clientOrderId: '1XZTVBTGS4K1e'
          });
        });
      }
    };

    await binance.order(Order.createStopLossOrder('BTCUSD', -1337, 12));
    assert.equal(1, (await binance.getOrders()).length);
    assert.equal(1, (await binance.getOrdersForSymbol('BTCUSD')).length);

    const order = await binance.cancelOrder(1740797);

    assert.equal(1740797, order.id);
    assert.equal('canceled', order.status);
  });

  it('order cancelAll orders', async () => {
    const binance = new Binance();
    binance.client = {
      order: () => {
        return new Promise(resolve => {
          resolve({
            symbol: 'BTCUSD',
            orderId: 1740797,
            clientOrderId: '1XZTVBTGS4K1e',
            transactTime: 1514418413947,
            price: '0.00020000',
            origQty: '100.10000000',
            executedQty: '0.00000000',
            status: 'PARTIALLY_FILLED',
            timeInForce: 'GTC',
            type: 'STOP_LOSS',
            side: 'SELL'
          });
        });
      },
      cancelOrder: () => {
        return new Promise(resolve => {
          resolve({
            symbol: 'BTCUSD',
            origClientOrderId: '1XZTVBTGS4K1e',
            orderId: 1740797,
            clientOrderId: '1XZTVBTGS4K1e'
          });
        });
      }
    };

    await binance.order(Order.createStopLossOrder('BTCUSD', -1337, 12));
    assert.equal(1, (await binance.getOrders()).length);
    assert.equal(1, (await binance.getOrdersForSymbol('BTCUSD')).length);

    const orders = await binance.cancelAll('BTCUSD');

    assert.equal('canceled', orders[0].status);

    assert.equal(0, (await binance.getOrders()).length);
    assert.equal(0, (await binance.getOrdersForSymbol('BTCUSD')).length);
  });

  it('test that positions are open based on balances', async () => {
    const binance = new Binance(undefined, { debug: () => {}, error: () => {} });

    binance.symbols = [
      {
        symbol: 'XRPUSDT',
        trade: {
          capital: 3000
        }
      }
    ];

    let myOrder;
    binance.client = {
      order: async order => {
        myOrder = order;

        return {
          symbol: 'FOOUSD',
          orderId: 25035356,
          clientOrderId: 'web_f4ab3eae12844370a056685f0e52617e_REST',
          price: '10400',
          origQty: '0.000962',
          status: 'NEW',
          type: 'LIMIT',
          side: 'BUY',
          time: 1601049698994,
          updateTime: 1601049698994
        };
      },
      allOrders: async opts => {
        const newVar = {
          XRPUSDT: [
            {
              clientOrderId: 'web_2e31730aa5814006a6295c1779a68eab',
              cummulativeQuoteQty: '499.97581200',
              executedQty: '1822.80000000',
              icebergQty: '0.00000000',
              isWorking: true,
              orderId: 278520093,
              origQty: '1822.80000000',
              price: '0.27429000',
              side: 'BUY',
              status: 'FILLED',
              stopPrice: '0.00000000',
              symbol: 'XRPUSDT',
              time: new Date(),
              timeInForce: 'GTC',
              type: 'LIMIT',
              updateTime: 1571933622396
            }
          ]
        };

        return newVar[opts.symbol] || [];
      },
      accountInfo: async () => {
        return {
          balances: [
            {
              asset: 'XRP',
              free: '3000',
              locked: '0.00000000'
            }
          ]
        };
      }
    };

    await binance.syncBalances();
    await binance.syncTradesForEntries();

    const positions = await binance.getPositions();
    assert.strictEqual(positions.length, 1);

    // close position
    await binance.order(Order.createLimitPostOnlyOrder('XRPUSDT', Order.SIDE_LONG, 6666, 1));
    assert.strictEqual(myOrder.symbol, 'XRPUSDT');
    assert.strictEqual(myOrder.side, 'BUY');
    assert.strictEqual(myOrder.quantity, 1);
    assert.strictEqual(myOrder.price, 6666);
    assert.strictEqual(myOrder.type, 'LIMIT');
  });

  it('test init of balances via account info', async () => {
    const binance = new Binance(undefined, { debug: () => {} });

    binance.client = {
      accountInfo: async () => JSON.parse(fs.readFileSync(`${__dirname}/binance/account-info.json`, 'utf8'))
    };

    await binance.syncBalances();

    const { balances } = binance;

    assert.equal(balances.length, 3);

    assert.equal(balances.find(balance => balance.asset === 'TNT').available > 0.1, true);
    assert.equal(balances.find(balance => balance.asset === 'TNT').locked > 1, true);
  });

  it('test placing order on balance issue', async () => {
    const binance = new Binance(undefined, {
      error: () => {}
    });

    binance.client = {
      order: () => {
        throw new Error('Account has insufficient balance for requested action');
      }
    };

    const order = await binance.order(Order.createMarketOrder('FOOBAR', 12));

    assert.strictEqual(order.retry, false);
    assert.strictEqual(order.status, 'rejected');
    assert.strictEqual(order.symbol, 'FOOBAR');
    assert.strictEqual(order.amount, 12);
    assert.strictEqual(order.type, 'market');
  });

  it('test mapping order request mapping for websocket and rest json', async () => {
    const orders1 = getOrders();
    const orders = Binance.createOrders(...orders1);

    assert.strictEqual(orders[0].retry, false);
    assert.strictEqual(orders[0].status, 'open');
    assert.strictEqual(orders[0].symbol, 'BTCUSDT');
    assert.strictEqual(orders[0].amount, 0.000962);
    assert.strictEqual(orders[0].type, 'limit');
    assert.strictEqual(orders[0].ourId, 'web_f4ab3eae12844370a056685f0e52617e_WEBSOCKET');
    assert.strictEqual(orders[0].side, 'buy');
    assert.strictEqual(orders[0].createdAt.getFullYear(), 2020);

    assert.strictEqual(orders[1].retry, false);
    assert.strictEqual(orders[1].status, 'open');
    assert.strictEqual(orders[1].symbol, 'BTCUSDT');
    assert.strictEqual(orders[1].amount, 0.000962);
    assert.strictEqual(orders[1].type, 'limit');
    assert.strictEqual(orders[1].ourId, 'web_f4ab3eae12844370a056685f0e52617e_REST');
    assert.strictEqual(orders[1].side, 'buy');
    assert.strictEqual(orders[1].createdAt.getFullYear(), 2020);

    assert.strictEqual(orders[2].retry, false);
    assert.strictEqual(orders[2].status, 'done');
    assert.strictEqual(orders[2].symbol, 'BTCUSDT');
    assert.strictEqual(orders[2].amount, 0);
    assert.strictEqual(orders[2].type, 'market');
    assert.strictEqual(orders[2].ourId, 'web_c5dc7e3efb5c43268adffe692cadceb1_WEBSOCKET_MARKET');
    assert.strictEqual(orders[2].side, 'buy');
    assert.strictEqual(orders[2].createdAt.getFullYear(), 2020);

    assert.strictEqual(orders[4].status, 'open');
    assert.strictEqual(orders[4].symbol, 'EURBUSD');
    assert.strictEqual(orders[4].type, 'limit');
    assert.strictEqual(orders[4].side, 'sell');
    assert.strictEqual(orders[4].amount, 598.34);

    assert.strictEqual(orders[5].status, 'open');
    assert.strictEqual(orders[5].symbol, 'BTCUSDT');
    assert.strictEqual(orders[5].type, 'limit');
    assert.strictEqual(orders[5].side, 'buy');
    assert.strictEqual(orders[5].amount, 0.000611);

    assert.strictEqual(orders[6].status, 'done');
    assert.strictEqual(orders[6].symbol, 'BTCUSDT');
    assert.strictEqual(orders[6].type, 'limit');
    assert.strictEqual(orders[6].side, 'sell');
    assert.strictEqual(orders[6].amount, 0);
  });

  const getEvent = function(find) {
    return JSON.parse(fs.readFileSync(`${__dirname}/binance/events.json`, 'utf8')).find(find);
  };

  const getOrders = function() {
    return JSON.parse(fs.readFileSync(`${__dirname}/binance/orders.json`, 'utf8'));
  };
});
