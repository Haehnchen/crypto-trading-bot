const assert = require('assert');
const PairStateExecution = require('../../../src/modules/pairs/pair_state_execution');
const ExchangeOrder = require('../../../src/dict/exchange_order');
const Position = require('../../../src/dict/position');
const PairState = require('../../../src/dict/pair_state');
const OrderCapital = require('../../../src/dict/order_capital');

describe('#pair state execution', function() {
  it('test limit open order trigger for long', async () => {
    let myOrder;

    const executor = new PairStateExecution(
      undefined,
      {
        calculateOrderSizeCapital: () => {
          return 1337;
        }
      },
      {
        executeOrder: (exchange, order) => {
          myOrder = order;
          return undefined;
        }
      },
      undefined
    );

    await executor.pairStateExecuteOrder(
      PairState.createLong('exchange', 'BTCUSD', OrderCapital.createAsset(1337), {}, true, () => {})
    );

    assert.equal(myOrder.symbol, 'BTCUSD');
    assert.equal(myOrder.side, 'long');
    assert.equal(myOrder.price, undefined);
    assert.equal(myOrder.amount, 1337);
    assert.equal(myOrder.type, 'limit');
    assert.equal(myOrder.options.post_only, true);
    assert.equal(myOrder.hasAdjustedPrice(), true);
  });

  it('test limit open order trigger for long (market)', async () => {
    let myOrder;

    const executor = new PairStateExecution(
      undefined,
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: (exchange, order) => {
          myOrder = order;
          return undefined;
        }
      },
      undefined
    );

    await executor.pairStateExecuteOrder(
      PairState.createLong('exchange', 'BTCUSD', OrderCapital.createAsset(1337), { market: true }, {}, () => {})
    );

    assert.equal(myOrder.symbol, 'BTCUSD');
    assert.equal(myOrder.side, 'long');
    assert.equal(myOrder.price > 0, true);
    assert.equal(myOrder.amount, 1337);
    assert.equal(myOrder.type, 'market');
    assert.equal(myOrder.hasAdjustedPrice(), false);
  });

  it('test limit open order trigger for short', async () => {
    let myOrder;

    const executor = new PairStateExecution(
      undefined,
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: (exchange, order) => {
          myOrder = order;
          return undefined;
        }
      },
      undefined
    );

    await executor.pairStateExecuteOrder(
      PairState.createShort('exchange', 'BTCUSD', OrderCapital.createAsset(1337), {}, true, () => {})
    );

    assert.equal(myOrder.symbol, 'BTCUSD');
    assert.equal(myOrder.side, 'short');
    assert.equal(myOrder.price, undefined);
    assert.equal(myOrder.amount, -1337);
    assert.equal(myOrder.type, 'limit');
    assert.equal(myOrder.options.post_only, true);
    assert.equal(myOrder.hasAdjustedPrice(), true);
  });

  it('test limit open order trigger for long (short)', async () => {
    let myOrder;

    const executor = new PairStateExecution(
      undefined,
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: (exchange, order) => {
          myOrder = order;
          return undefined;
        }
      },
      undefined
    );

    await executor.pairStateExecuteOrder(
      PairState.createShort('exchange', 'BTCUSD', OrderCapital.createAsset(1337), { market: true }, true, () => {})
    );

    assert.equal(myOrder.symbol, 'BTCUSD');
    assert.equal(myOrder.side, 'short');
    assert.equal(myOrder.price < 0, true);
    assert.equal(myOrder.amount, -1337);
    assert.equal(myOrder.type, 'market');
    assert.equal(myOrder.hasAdjustedPrice(), false);
  });

  it('test limit close order trigger for long', async () => {
    let myOrder;

    const executor = new PairStateExecution(
      {
        get: () => {
          return { calculateAmount: v => v };
        }
      },
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: async (exchange, order) => {
          myOrder = order;
          return undefined;
        }
      },
      undefined
    );

    await executor.executeCloseOrder('exchange', 'BTCUSD', 1337, {});

    assert.equal(myOrder.symbol, 'BTCUSD');
    assert.equal(myOrder.side, 'long');
    assert.equal(myOrder.price, undefined);
    assert.equal(myOrder.amount, 1337);
    assert.equal(myOrder.type, 'limit');
    assert.equal(myOrder.options.post_only, true);
    assert.equal(myOrder.hasAdjustedPrice(), true);
  });

  it('test market close order trigger for long', async () => {
    let myOrder;

    const executor = new PairStateExecution(
      {
        get: () => {
          return { calculateAmount: v => v };
        }
      },
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: (exchange, order) => {
          myOrder = order;
          return undefined;
        }
      },
      undefined
    );

    await executor.executeCloseOrder('exchange', 'BTCUSD', 1337, { market: true });

    assert.equal(myOrder.symbol, 'BTCUSD');
    assert.equal(myOrder.side, 'long');
    assert.equal(myOrder.price > 0, true);
    assert.equal(myOrder.amount, 1337);
    assert.equal(myOrder.type, 'market');
    assert.deepEqual(myOrder.options, {});
  });

  it('test market close order trigger for short', async () => {
    let myOrder;

    const logMessages = {
      info: [],
      error: []
    };

    const executor = new PairStateExecution(
      {
        get: () => {
          return { calculateAmount: v => v };
        }
      },
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: (exchange, order) => {
          myOrder = order;
          return undefined;
        }
      },
      undefined
    );

    await executor.executeCloseOrder('exchange', 'BTCUSD', -1337, { market: true });

    assert.equal(myOrder.symbol, 'BTCUSD');
    assert.equal(myOrder.side, 'short');
    assert.equal(myOrder.price < 0, true);
    assert.equal(myOrder.amount, -1337);
    assert.equal(myOrder.type, 'market');
    assert.deepEqual(myOrder.options, {});
  });

  it('test buy/sell directly filled', async () => {
    const logMessages = {
      info: []
    };

    const executor = new PairStateExecution(
      {
        getPosition: async () => undefined,
        getOrders: async () => []
      },
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: async () =>
          new ExchangeOrder(
            'foobar',
            'ADAUSDT',
            'done',
            undefined,
            undefined,
            undefined,
            undefined,
            'buy',
            ExchangeOrder.TYPE_LIMIT
          )
      },
      {
        info: message => {
          logMessages.info.push(message);
        }
      }
    );

    const clearCalls = [];
    await executor.onSellBuyPair(
      PairState.createLong('foobar', 'ADAUSDT', OrderCapital.createAsset(1337), {}, true, () => {
        clearCalls.push([]);
      })
    );

    assert.strictEqual(clearCalls.length, 1);

    assert.strictEqual(logMessages.info.filter(msg => msg.includes('position open order')).length, 1);
    assert.strictEqual(logMessages.info.filter(msg => msg.includes('directly filled clearing state')).length, 1);
  });

  it('test buy/sell rejected and state is cleared', async () => {
    const logMessages = {
      info: [],
      error: []
    };

    const executor = new PairStateExecution(
      {
        getPosition: async () => undefined,
        getOrders: async () => []
      },
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: async () =>
          new ExchangeOrder(
            'foobar',
            'ADAUSDT',
            ExchangeOrder.STATUS_REJECTED,
            undefined,
            undefined,
            false,
            undefined,
            'buy',
            ExchangeOrder.TYPE_LIMIT
          )
      },
      {
        info: message => {
          logMessages.info.push(message);
        },
        error: message => {
          logMessages.error.push(message);
        }
      }
    );

    const clearCalls = [];
    await executor.onSellBuyPair(
      PairState.createLong(
        'foobar',
        'ADAUSDT',
        OrderCapital.createAsset(1337),
        () => {},
        true,
        () => {
          clearCalls.push([]);
        }
      )
    );

    assert.strictEqual(clearCalls.length, 1);

    assert.strictEqual(logMessages.info.filter(msg => msg.includes('position open order')).length, 1);
    assert.strictEqual(logMessages.error.filter(msg => msg.includes('order rejected clearing pair state')).length, 1);
  });

  it('test buy/sell directly filled for closing an order', async () => {
    const logMessages = {
      info: []
    };

    const executor = new PairStateExecution(
      {
        getPosition: async () => new Position('ADAUSDT', 'long', 1337),
        getOrders: async () => [],
        get: () => {
          return { calculateAmount: v => v };
        }
      },
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: async () =>
          new ExchangeOrder(
            'foobar',
            'ADAUSDT',
            'done',
            undefined,
            undefined,
            undefined,
            undefined,
            'buy',
            ExchangeOrder.TYPE_LIMIT
          )
      },
      {
        info: message => {
          logMessages.info.push(message);
        }
      }
    );

    const clearCalls = [];
    const pairState = new PairState('foobar', 'ADAUSDT', 'long', {}, true, () => {
      clearCalls.push([]);
    });

    await executor.onClosePair(pairState);

    assert.strictEqual(clearCalls.length, 1);

    assert.strictEqual(logMessages.info.filter(msg => msg.includes('position close order')).length, 1);
    assert.strictEqual(logMessages.info.filter(msg => msg.includes('directly filled clearing state')).length, 1);
  });

  it('test onPairStateExecutionTick calling', async () => {
    const logMessages = {
      error: []
    };

    const clearCalls = [];
    const pairState = new PairState('foobar', 'ADAUSDT', 'long', {}, true, () => {
      clearCalls.push([]);
    });

    for (let i = 0; i < 20; i++) {
      pairState.triggerRetry();
    }

    const executor = new PairStateExecution(
      {
        getPosition: async () => new Position('ADAUSDT', 'long', 1337),
        getOrders: async () => [],
        get: () => {
          return { calculateAmount: v => v };
        }
      },
      {
        calculateOrderSizeCapital: async () => {
          return 1337;
        }
      },
      {
        executeOrder: async () =>
          new ExchangeOrder(
            'foobar',
            'ADAUSDT',
            'done',
            undefined,
            undefined,
            undefined,
            undefined,
            'buy',
            ExchangeOrder.TYPE_LIMIT
          ),
        cancelAll: async () => {}
      },
      {
        error: message => {
          logMessages.error.push(message);
        }
      }
    );

    await executor.onPairStateExecutionTick(pairState);

    assert.strictEqual(clearCalls.length, 1);
    assert.strictEqual(logMessages.error.filter(msg => msg.includes('max retries')).length, 1);
  });
});
