const assert = require('assert');
const TickListener = require('../../../src/modules/listener/tick_listener');
const Ticker = require('../../../src/dict/ticker');
const SignalResult = require('../../../src/modules/strategy/dict/signal_result');

describe('#tick listener for order', function() {
  it('test tick listener for live order', async () => {
    let updates = [];

    const listener = new TickListener(
      { get: () => new Ticker('unknown', 'BTC', 123456, 12, 12) },
      {},
      { send: () => {} },
      { signal: () => {} },
      {
        executeStrategy: async () => {
          return SignalResult.createSignal('short', {});
        }
      },
      {
        getPosition: async () => {
          return undefined;
        }
      },
      {
        update: async (exchange, symbol, signal) => {
          updates.push(exchange, symbol, signal);
          return [];
        }
      },
      { info: () => {} }
    );

    await listener.visitTradeStrategy('foobar', {
      symbol: 'FOOUSD',
      exchange: 'FOOBAR'
    });

    assert.deepEqual(['FOOBAR', 'FOOUSD', 'short'], updates);

    // reset; block for time window
    updates = [];
    await listener.visitTradeStrategy('foobar', {
      symbol: 'FOOUSD',
      exchange: 'FOOBAR'
    });

    assert.deepEqual([], updates);
  });

  it('test tick listener for notifier order', async () => {
    const calls = [];

    const listener = new TickListener(
      { get: () => new Ticker('unknown', 'BTC', 123456, 12, 12) },
      {},
      { send: () => {} },
      {
        signal: (exchange, symbol, opts, signal, strategyKey) => {
          calls.push(exchange, symbol, opts, signal, strategyKey);
          return [];
        }
      },
      {
        executeStrategy: async () => {
          return SignalResult.createSignal('short', {});
        }
      },
      {
        getPosition: async () => {
          return undefined;
        }
      },
      {},
      { info: () => {} }
    );

    await listener.visitStrategy(
      { strategy: 'foobar' },
      {
        symbol: 'FOOUSD',
        exchange: 'FOOBAR'
      }
    );

    assert.deepEqual(calls, [
      'FOOBAR',
      'FOOUSD',
      { price: 12, strategy: 'foobar', raw: '{"_debug":{},"_signal":"short","placeOrders":[]}' },
      'short',
      'foobar'
    ]);
  });
});
