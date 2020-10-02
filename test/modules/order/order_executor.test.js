const assert = require('assert');
const moment = require('moment');
const OrderExecutor = require('../../../src/modules/order/order_executor');
const Order = require('../../../src/dict/order');
const PairState = require('../../../src/dict/pair_state');
const Ticker = require('../../../src/dict/ticker');
const ExchangeOrder = require('../../../src/dict/exchange_order');

describe('#order executor', () => {
  it('test order create execution', async () => {
    const exchangeOrders = [
      new ExchangeOrder(
        '1815-1337-1',
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    ];

    const configs = {
      'order.retry': 3,
      'order.retry_ms': 8
    };

    const pairState = new PairState('exchange', 'FOOUSD', 'short', {}, true, () => {});

    let i = 0;
    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            order: () => {
              return exchangeOrders[i++];
            }
          };
        }
      },
      undefined,
      {
        getConfig: key => {
          return configs[key];
        }
      },
      { info: () => {}, error: () => {} },
      { all: () => [pairState] }
    );

    const result = await executor.executeOrder('foobar', Order.createLimitPostOnlyOrderAutoSide('BTCUSD', 1337, -10));

    assert.equal(i, 1);
    assert.equal(result.id, '1815-1337-1');
  });

  it('test order create execution with retry', async () => {
    const exchangeOrders = [
      new ExchangeOrder(
        '1815-1337-1',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      new ExchangeOrder(
        '1815-1337-2',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      new ExchangeOrder(
        '1815-1337-3',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      new ExchangeOrder(
        '1815-1337-4',
        undefined,
        undefined,
        undefined,
        undefined,
        false,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    ];

    const configs = {
      'order.retry': 3,
      'order.retry_ms': 8
    };

    let i = 0;
    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            order: () => {
              return exchangeOrders[i++];
            }
          };
        }
      },
      undefined,
      {
        getConfig: key => {
          return configs[key];
        }
      },
      { info: () => {}, error: () => {} }
    );

    const result = await executor.executeOrder('foobar', Order.createLimitPostOnlyOrderAutoSide('BTCUSD', 1337, -10));

    assert.equal(i, 4);
    assert.equal(result.id, '1815-1337-4');
  });

  it('test order create execution with out of retry limit', async () => {
    const exchangeOrders = [
      new ExchangeOrder(
        '1815-1337-1',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      new ExchangeOrder(
        '1815-1337-2',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      new ExchangeOrder(
        '1815-1337-3',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      new ExchangeOrder(
        '1815-1337-4',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      ),
      new ExchangeOrder(
        '1815-1337-4',
        undefined,
        undefined,
        undefined,
        undefined,
        true,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      )
    ];

    const configs = {
      'order.retry': 3,
      'order.retry_ms': 8
    };

    let i = 0;
    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            order: () => {
              return exchangeOrders[i++];
            }
          };
        }
      },
      undefined,
      {
        getConfig: key => {
          return configs[key];
        }
      },
      { info: () => {}, error: () => {} }
    );

    const result = await executor.executeOrder('foobar', Order.createLimitPostOnlyOrderAutoSide('BTCUSD', 1337, -10));

    assert.equal(i, 4);
    assert.equal(result, undefined);
  });

  it('test that adjust price handler must clean up unknown orders', async () => {
    const exchangeOrder = new ExchangeOrder(
      '1815-1337',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'buy',
      ExchangeOrder.TYPE_LIMIT
    );

    const pairState = new PairState('exchange', 'FOOUSD', 'short', {}, true, () => {});
    pairState.setExchangeOrder(exchangeOrder);

    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            findOrderById: () => {
              return exchangeOrder;
            }
          };
        }
      },
      undefined,
      undefined,
      { debug: () => {} },
      { all: () => [pairState] }
    );

    await executor.adjustOpenOrdersPrice();
    assert.equal('1815-1337' in executor.runningOrders, false);
  });

  it('test that adjust price handler must clean up outdated managed orders', async () => {
    const executor = new OrderExecutor(undefined, undefined, undefined, { debug: () => {} }, { all: () => [] });

    // current
    executor.runningOrders['1815-1337'] = new Date();
    await executor.adjustOpenOrdersPrice();
    assert.equal('1815-1337' in executor.runningOrders, true);

    // outdated
    executor.runningOrders['1815-1337'] = moment().subtract(180, 'minutes');
    await executor.adjustOpenOrdersPrice();
    assert.equal('1815-1337' in executor.runningOrders, false);
  });

  it('test that price adjust order is created for long', async () => {
    const exchangeOrder = new ExchangeOrder(
      '1815-1337',
      undefined,
      'open',
      undefined,
      undefined,
      undefined,
      undefined,
      'buy',
      ExchangeOrder.TYPE_LIMIT
    );

    let exchangeName;
    let orderUpdate;

    const pairState = new PairState('exchange', 'FOOUSD', 'short', {}, true, () => {});
    pairState.setExchangeOrder(exchangeOrder);

    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            findOrderById: () => {
              return new Promise(resolve => {
                resolve(exchangeOrder);
              });
            },
            updateOrder: (myExchangeName, myOrderUpdate) => {
              return new Promise(resolve => {
                exchangeName = myExchangeName;
                orderUpdate = myOrderUpdate;

                resolve(exchangeOrder);
              });
            }
          };
        }
      },
      {
        getIfUpToDate: () => {
          return new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338);
        }
      },
      undefined,
      { info: () => {}, error: () => {} }
    );

    await executor.adjustOpenOrdersPrice(pairState);

    assert.equal(orderUpdate.price, 1337);
    assert.equal(Object.keys(executor.runningOrders).length, 0);
  });

  it('test that price adjust order is recreated on placing error [long]', async () => {
    const exchangeOrder = new ExchangeOrder(
      '1815-1337',
      undefined,
      'open',
      337,
      1331,
      false,
      undefined,
      'buy',
      ExchangeOrder.TYPE_LIMIT
    );

    const logMessages = {
      info: [],
      error: []
    };

    const pairState = new PairState('exchange', 'FOOUSD', 'short', {}, true, () => {});
    pairState.setExchangeOrder(exchangeOrder);

    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            findOrderById: async () => exchangeOrder,
            updateOrder: () =>
              new ExchangeOrder(
                '1815-1337',
                undefined,
                'canceled',
                1339,
                undefined,
                true,
                undefined,
                'buy',
                ExchangeOrder.TYPE_LIMIT
              )
          };
        }
      },
      { getIfUpToDate: () => new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338) },
      { getConfig: (key, defaultValue) => defaultValue },
      {
        info: message => {
          logMessages.info.push(message);
        },
        error: message => {
          logMessages.error.push(message);
        }
      }
    );

    let retryOrder;
    executor.executeOrder = async (exchange, order) => {
      retryOrder = order;
    };

    await executor.adjustOpenOrdersPrice(pairState);

    assert.strictEqual(retryOrder.amount, 1331);
    assert.strictEqual(retryOrder.hasAdjustedPrice(pairState), true);

    assert.strictEqual(logMessages.error.filter(msg => msg.includes('canceled recreate')).length, 1);
    assert.strictEqual(logMessages.error.filter(msg => msg.includes('replacing canceled order')).length, 1);
  });

  it('test that price adjust order is recreated on placing error [short]', async () => {
    const exchangeOrder = new ExchangeOrder(
      '1815-1337',
      undefined,
      'open',
      337,
      1331,
      false,
      undefined,
      'sell',
      ExchangeOrder.TYPE_LIMIT
    );

    const logMessages = {
      info: [],
      error: []
    };

    const pairState = new PairState('exchange', 'FOOUSD', 'short', {}, true, () => {});
    pairState.setExchangeOrder(exchangeOrder);

    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            findOrderById: async () => exchangeOrder,
            updateOrder: () =>
              new ExchangeOrder(
                '1815-1337',
                undefined,
                'canceled',
                1339,
                undefined,
                true,
                undefined,
                'buy',
                ExchangeOrder.TYPE_LIMIT
              )
          };
        }
      },
      { getIfUpToDate: () => new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338) },
      { getConfig: (key, defaultValue) => defaultValue },
      {
        info: message => {
          logMessages.info.push(message);
        },
        error: message => {
          logMessages.error.push(message);
        }
      }
    );

    let retryOrder;
    executor.executeOrder = async (exchange, order) => {
      retryOrder = order;
    };

    await executor.adjustOpenOrdersPrice(pairState);

    assert.strictEqual(retryOrder.amount, -1331);
    assert.strictEqual(retryOrder.hasAdjustedPrice(), true);

    assert.strictEqual(logMessages.error.filter(msg => msg.includes('canceled recreate')).length, 1);
    assert.strictEqual(logMessages.error.filter(msg => msg.includes('replacing canceled order')).length, 1);
  });

  it('test that price adjust order is created for short', async () => {
    const exchangeOrder = new ExchangeOrder(
      '1815-1337',
      undefined,
      'open',
      undefined,
      undefined,
      undefined,
      undefined,
      'sell',
      ExchangeOrder.TYPE_LIMIT
    );

    let exchangeName;
    let orderUpdate;

    const pairState = new PairState('exchange', 'FOOUSD', 'short', {}, true, () => {});
    pairState.setExchangeOrder(exchangeOrder);

    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            findOrderById: () => {
              return new Promise(resolve => {
                resolve(exchangeOrder);
              });
            },
            updateOrder: (myExchangeName, myOrderUpdate) => {
              return new Promise(resolve => {
                exchangeName = myExchangeName;
                orderUpdate = myOrderUpdate;

                resolve(exchangeOrder);
              });
            }
          };
        }
      },
      { getIfUpToDate: () => new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338) },
      undefined,
      { info: () => {}, error: () => {} }
    );

    await executor.adjustOpenOrdersPrice(pairState);

    assert.equal(orderUpdate.price, -1338);
    assert.equal(Object.keys(executor.runningOrders).length, 0);
  });

  it('test that all orders are canceled', async () => {
    let mySymbol;

    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            cancelAll: symbol => {
              return new Promise(resolve => {
                mySymbol = symbol;

                resolve();
              });
            }
          };
        }
      },
      {
        getIfUpToDate: () => {
          return new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338);
        }
      },
      undefined,
      { info: () => {}, error: () => {} }
    );

    await executor.cancelAll('FOO_EXCHANGE', 'test');

    assert.equal(mySymbol, 'test');
  });

  it('test that order is canceled', async () => {
    let mySymbol;

    const executor = new OrderExecutor(
      {
        get: () => {
          return {
            cancelOrder: symbol => {
              return new Promise(resolve => {
                mySymbol = symbol;

                resolve();
              });
            }
          };
        }
      },
      {
        getIfUpToDate: () => {
          return new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338);
        }
      },
      undefined,
      { info: () => {}, error: () => {} }
    );

    await executor.cancelOrder('FOO_EXCHANGE', '1337-ABCD');

    assert.equal(mySymbol, '1337-ABCD');
  });

  it('test that current price is injected by time', async () => {
    let i = 0;

    const executor = new OrderExecutor(
      undefined,
      {
        getIfUpToDate: () => {
          return i++ > 5 ? new Ticker('exchange', 'FOOUSD', new Date(), 1337, 1338) : undefined;
        }
      },
      undefined,
      { info: () => {}, error: () => {} }
    );

    executor.tickerPriceInterval = 2;

    const price = await executor.getCurrentPrice('FOO_EXCHANGE', '1337-ABCD', 'short');

    assert.equal(i > 1, true);
    assert.equal(price, -1338);
  });
});
