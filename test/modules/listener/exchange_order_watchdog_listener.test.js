const assert = require('assert');
const ExchangeOrderWatchdogListener = require('../../../src/modules/listener/exchange_order_watchdog_listener');
const Ticker = require('../../../src/dict/ticker');
const StopLossCalculator = require('../../../src/modules/order/stop_loss_calculator');
const Position = require('../../../src/dict/position');
const ExchangeOrder = require('../../../src/dict/exchange_order');

describe('#watchdogs are working', () => {
  const fakeLogger = { info: () => {}, error: () => {} };
  let calls = [];
  const fakeExchange = {
    getName: () => 'foobar',
    getOrdersForSymbol: async () => [],
    calculatePrice: price => price,
    order: async order => calls.push(order),
    updateOrder: async (id, order) => calls.push({ id: id, order: order })
  };

  it('watchdog for stoploss is working (long)', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      {},
      {},
      {},
      {
        update: async (exchange, symbol, state) => {
          calls.push(exchange, symbol, state);
        }
      },
      fakeLogger,
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101) }
    );

    calls = [];
    await listener.stoplossWatch(fakeExchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
      stop: 0.9
    });
    assert.deepEqual(calls, ['foobar', 'FOOUSD', 'close']);
  });

  it('watchdog for stoploss is working (long) but valid', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      {},
      {},
      {},
      {
        update: async (exchange, symbol, state) => {
          calls.push(exchange, symbol, state);
        }
      },
      fakeLogger,
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101) }
    );

    calls = [];
    await listener.stoplossWatch(fakeExchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
      stop: 1.9
    });
    assert.deepEqual(calls, []);
  });

  it('watchdog for stoploss is working (long) profitable', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      {},
      {},
      {},
      {
        update: async (exchange, symbol, state) => {
          calls.push(exchange, symbol, state);
        }
      },
      fakeLogger,
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 100, 101) }
    );

    calls = [];
    await listener.stoplossWatch(fakeExchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
      stop: 0.9
    });
    assert.deepEqual(calls, []);
  });

  it('watchdog for stoploss is working (short)', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      {},
      {},
      {},
      {
        update: async (exchange, symbol, state) => {
          calls.push(exchange, symbol, state);
        }
      },
      fakeLogger,
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101) }
    );

    calls = [];
    await listener.stoplossWatch(fakeExchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      stop: 0.9
    });
    assert.deepEqual(calls, ['foobar', 'FOOUSD', 'close']);
  });

  it('watchdog for stoploss is working (short) but valid', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      {},
      {},
      {},
      {
        update: async (exchange, symbol, state) => {
          calls.push(exchange, symbol, state);
        }
      },
      fakeLogger,
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101) }
    );

    calls = [];
    await listener.stoplossWatch(fakeExchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      stop: 1.1
    });

    assert.deepEqual(calls, []);
  });

  it('watchdog for stoploss is working (short) profitable', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      {},
      {},
      {},
      {
        update: async (exchange, symbol, state) => {
          calls.push(exchange, symbol, state);
        }
      },
      fakeLogger,
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 98, 99) }
    );

    calls = [];
    await listener.stoplossWatch(fakeExchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      stop: 0.9
    });

    assert.deepEqual(calls, []);
  });

  it('closed position should clear open orders', async () => {
    const symbols = [
      { exchange: 'foobar', symbol: 'FOOUSD' },
      { exchange: 'foobar', symbol: 'BTCUSD', watchdogs: [{ name: 'stoploss' }] }
    ];
    const listener = new ExchangeOrderWatchdogListener(
      {},
      { symbols: symbols },
      {},
      {},
      {
        cancelAll: async (exchange, symbol) => {
          calls.push([exchange, symbol]);
        }
      },
      {},
      fakeLogger,
      {}
    );

    calls = [];
    await listener.onPositionChanged({
      getExchange: () => 'foobar',
      getSymbol: () => 'BTCUSD',
      isClosed: () => true
    });

    assert.deepStrictEqual(calls[0], ['foobar', 'BTCUSD']);
  });

  it('closed position without watchdog should be ignored', async () => {
    const symbols = [{ exchange: 'foobar', symbol: 'BTCUSD' }];
    const listener = new ExchangeOrderWatchdogListener(
      {},
      { symbols: symbols },
      {},
      {},
      {
        cancelAll: async (exchange, symbol) => {
          calls.push([exchange, symbol]);
        }
      },
      {},
      fakeLogger,
      {}
    );

    calls = [];
    await listener.onPositionChanged({
      getExchange: () => 'foobar',
      getSymbol: () => 'BTCUSD',
      isClosed: () => true
    });

    assert.deepStrictEqual(calls.length, 0);
  });

  it('watchdog for trailing stoploss is working (long)', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      new StopLossCalculator({ get: () => new Ticker('foobar', 'BTCUSD', undefined, 105, 106) }, fakeLogger),
      {},
      {},
      {},
      fakeLogger,
      {}
    );

    calls = [];
    await listener.trailingStoplossWatch(fakeExchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
      target_percent: 5.0,
      stop_percent: 1.0
    });

    delete calls[0].id;
    assert.deepEqual(calls, [
      {
        amount: 1,
        options: {
          close: true
        },
        price: -1.05,
        side: 'short',
        symbol: 'FOOUSD',
        type: 'trailing_stop'
      }
    ]);
  });

  it('watchdog for trailing stoploss is working (long) not activated', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      new StopLossCalculator({ get: () => new Ticker('foobar', 'BTCUSD', undefined, 103, 104) }, fakeLogger),
      {},
      {},
      {},
      fakeLogger,
      {}
    );

    calls = [];
    await listener.trailingStoplossWatch(fakeExchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
      target_percent: 5.0,
      stop_percent: 1.0
    });
    assert.deepEqual(calls, []);
  });

  it('watchdog for trailing stoploss is working (short)', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      new StopLossCalculator({ get: () => new Ticker('foobar', 'BTCUSD', undefined, 94, 94) }, fakeLogger),
      {},
      {},
      {},
      fakeLogger,
      {}
    );

    calls = [];
    await listener.trailingStoplossWatch(fakeExchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      target_percent: 5.0,
      stop_percent: 1.0
    });

    delete calls[0].id;
    assert.deepEqual(calls, [
      {
        amount: 1,
        options: {
          close: true
        },
        price: 0.95,
        side: 'long',
        symbol: 'FOOUSD',
        type: 'trailing_stop'
      }
    ]);
  });

  it('watchdog for trailing stoploss is working (short) not activated', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      new StopLossCalculator({ get: () => new Ticker('foobar', 'BTCUSD', undefined, 96, 96) }, fakeLogger),
      {},
      {},
      {},
      fakeLogger,
      {}
    );

    calls = [];
    await listener.trailingStoplossWatch(fakeExchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      target_percent: 5.0,
      stop_percent: 1.0
    });

    assert.deepEqual(calls, []);
  });

  it('watchdog for trailing stoploss with existing stop order, update needed', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      new StopLossCalculator({ get: () => new Ticker('foobar', 'BTCUSD', undefined, 105, 106) }, fakeLogger),
      {},
      {},
      {},
      fakeLogger,
      {}
    );

    calls = [];
    const fakeExchange2 = Object.assign(fakeExchange, {
      getOrdersForSymbol: async () => [{ id: 123, amount: 0.5, type: ExchangeOrder.TYPE_TRAILING_STOP }]
    });
    await listener.trailingStoplossWatch(fakeExchange2, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
      target_percent: 5.0,
      stop_percent: 1.0
    });

    assert.deepEqual(calls, [
      {
        id: 123,
        order: { id: 123, side: 'short', amount: -1, price: undefined, symbol: undefined, type: undefined, options: {} }
      }
    ]);
  });

  it('watchdog for trailing stoploss with existing stop order, update not needed', async () => {
    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      new StopLossCalculator({ get: () => new Ticker('foobar', 'BTCUSD', undefined, 105, 106) }, fakeLogger),
      {},
      {},
      {},
      fakeLogger,
      {}
    );

    calls = [];
    const fakeExchange2 = Object.assign(fakeExchange, {
      getOrdersForSymbol: async () => [{ id: 123, amount: 1, type: ExchangeOrder.TYPE_TRAILING_STOP }]
    });
    await listener.trailingStoplossWatch(fakeExchange2, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
      target_percent: 5.0,
      stop_percent: 1.0
    });

    assert.deepEqual(calls, []);
  });
});
