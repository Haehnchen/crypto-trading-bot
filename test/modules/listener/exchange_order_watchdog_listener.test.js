const assert = require('assert');
const ExchangeOrderWatchdogListener = require('../../../src/modules/listener/exchange_order_watchdog_listener');
const Ticker = require('../../../src/dict/ticker');
const Position = require('../../../src/dict/position');

describe('#watchdogs are working', () => {
  it('watchdog for stoploss is working (long)', async () => {
    const calls = [];

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
      { info: () => {} },
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101) }
    );

    const exchange = { getName: () => 'foobar' };

    await listener.stoplossWatch(exchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), { stop: 0.9 });

    assert.deepEqual(calls, ['foobar', 'FOOUSD', 'close']);
  });

  it('watchdog for stoploss is working (long) but valid', async () => {
    const calls = [];

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
      { info: () => {} },
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101) }
    );

    const exchange = { getName: () => 'foobar' };

    await listener.stoplossWatch(exchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), { stop: 1.9 });

    assert.deepEqual(calls, []);
  });

  it('watchdog for stoploss is working (long) profitable', async () => {
    const calls = [];

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
      { info: () => {} },
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 100, 101) }
    );

    const exchange = { getName: () => 'foobar' };

    await listener.stoplossWatch(exchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), { stop: 0.9 });

    assert.deepEqual(calls, []);
  });

  it('watchdog for stoploss is working (short)', async () => {
    const calls = [];

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
      { info: () => {} },
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101) }
    );

    const exchange = { getName: () => 'foobar' };

    await listener.stoplossWatch(exchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      stop: 0.9
    });

    assert.deepEqual(calls, ['foobar', 'FOOUSD', 'close']);
  });

  it('watchdog for stoploss is working (short) but valid', async () => {
    const calls = [];

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
      { info: () => {} },
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101) }
    );

    const exchange = { getName: () => 'foobar' };

    await listener.stoplossWatch(exchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      stop: 1.1
    });

    assert.deepEqual(calls, []);
  });

  it('watchdog for stoploss is working (short) profitable', async () => {
    const calls = [];

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
      { info: () => {} },
      { get: () => new Ticker('foobar', 'BTCUSD', undefined, 98, 99) }
    );

    const exchange = { getName: () => 'foobar' };

    await listener.stoplossWatch(exchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      stop: 0.9
    });

    assert.deepEqual(calls, []);
  });

  it('closed position should clear open orders', async () => {
    const symbols = [
      { exchange: 'foobar', symbol: 'FOOUSD' },
      { exchange: 'foobar', symbol: 'BTCUSD', watchdogs: [{ name: 'stoploss' }] }
    ];

    const calls = [];
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
      { info: () => {} },
      {}
    );

    await listener.onPositionChanged({
      getExchange: () => 'foobar',
      getSymbol: () => 'BTCUSD',
      isClosed: () => true
    });

    assert.deepStrictEqual(calls[0], ['foobar', 'BTCUSD']);
  });

  it('closed position without watchdog should be ignored', async () => {
    const symbols = [{ exchange: 'foobar', symbol: 'BTCUSD' }];

    const calls = [];
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
      { info: () => {} },
      {}
    );

    await listener.onPositionChanged({
      getExchange: () => 'foobar',
      getSymbol: () => 'BTCUSD',
      isClosed: () => true
    });

    assert.deepStrictEqual(calls.length, 0);
  });

  it('watchdog for trailing stoploss is working (long)', async () => {
    const calls = [];

    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      { calculateForOpenPosition: async (_exchange, _position, _conf) => -105.0 },
      {},
      {},
      {},
      { info: () => {} },
      {}
    );

    const exchange = {
      getName: () => 'foobar',
      getOrdersForSymbol: async () => [],
      calculatePrice: price => price,
      order: async order => {
        calls.push(order);
      }
    };

    await listener.trailingStoplossWatch(exchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
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
        type: 'trailing-stop'
      }
    ]);
  });

  it('watchdog for trailing stoploss is working (long) not activated', async () => {
    const calls = [];

    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      { calculateForOpenPosition: async () => undefined },
      {},
      {},
      {},
      { info: () => {} },
      {}
    );

    const exchange = {
      getName: () => 'foobar',
      getOrdersForSymbol: async () => [],
      calculatePrice: price => price,
      order: async order => {
        calls.push(order);
      }
    };

    await listener.trailingStoplossWatch(exchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {
      target_percent: 5.0,
      stop_percent: 1.0
    });

    assert.deepEqual(calls, []);
  });

  it('watchdog for trailing stoploss is working (short)', async () => {
    const calls = [];

    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      { calculateForOpenPosition: async () => 95.0 },
      {},
      {},
      {},
      { info: () => {} },
      {}
    );

    // eslint-disable-next-line no-unused-vars
    const exchange = {
      getName: () => 'foobar',
      getOrdersForSymbol: async () => [],
      // eslint-disable-next-line no-unused-vars
      calculatePrice: price => price,
      order: async order => {
        calls.push(order);
      }
    };

    await listener.trailingStoplossWatch(exchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
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
        type: 'trailing-stop'
      }
    ]);
  });

  it('watchdog for trailing stoploss is working (short) not activated', async () => {
    const calls = [];

    const listener = new ExchangeOrderWatchdogListener(
      {},
      {},
      { calculateForOpenPosition: async () => undefined },
      {},
      {},
      {},
      { info: () => {} },
      {}
    );

    const exchange = {
      getName: () => 'foobar',
      getOrdersForSymbol: async () => [],
      calculatePrice: price => price,
      order: async order => {
        calls.push(order);
      }
    };

    await listener.trailingStoplossWatch(exchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {
      target_percent: 5.0,
      stop_percent: 1.0
    });

    assert.deepEqual(calls, []);
  });
});
