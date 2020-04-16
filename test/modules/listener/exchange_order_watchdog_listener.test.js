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
});
