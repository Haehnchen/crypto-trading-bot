const assert = require('assert');
const ExchangePositionWatcher = require('../../../src/modules/exchange/exchange_position_watcher');
const ExchangePosition = require('../../../src/dict/exchange_position');
const PositionStateChangeEvent = require('../../../src/event/position_state_change_event');
const Position = require('../../../src/dict/position');

describe('#exchange position watcher', () => {
  it('test that opened positions are triggered', async () => {
    const runs = [[], [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1))]];

    let i = 0;
    const events = {};
    const exchangeManager = new ExchangePositionWatcher(
      {
        getPositions: async () => {
          return runs[i++];
        }
      },
      {
        emit: (eventName, event) => {
          events[eventName] = event;
        }
      },
      { info: () => {} }
    );

    await exchangeManager.onPositionStateChangeTick();
    await exchangeManager.onPositionStateChangeTick();

    assert.strictEqual(Object.keys(exchangeManager.positions).length, 1);

    const event = events[PositionStateChangeEvent.EVENT_NAME];
    assert.strictEqual(event.getExchange(), 'foobar');
    assert.strictEqual(event.getSymbol(), 'BTCUSD');
    assert.strictEqual(event.isOpened(), true);
    assert.strictEqual(event.isClosed(), false);

    const position = event.getPosition();

    assert.strictEqual(position.symbol, 'BTCUSD');
  });

  it('test that closed positions are triggered', async () => {
    const runs = [[new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1))], []];

    let i = 0;
    const events = {};
    const exchangeManager = new ExchangePositionWatcher(
      {
        getPositions: async () => {
          return runs[i++];
        }
      },
      {
        emit: (eventName, event) => {
          events[eventName] = event;
        }
      },
      { info: () => {} }
    );

    await exchangeManager.onPositionStateChangeTick();
    await exchangeManager.onPositionStateChangeTick();

    assert.strictEqual(Object.keys(exchangeManager.positions).length, 0);

    const event = events[PositionStateChangeEvent.EVENT_NAME];
    assert.strictEqual(event.getExchange(), 'foobar');
    assert.strictEqual(event.getSymbol(), 'BTCUSD');
    assert.strictEqual(event.isOpened(), false);
    assert.strictEqual(event.isClosed(), true);

    const position = event.getPosition();

    assert.strictEqual(position.symbol, 'BTCUSD');
  });

  it('test that no change should not trigger event', async () => {
    const runs = [
      [
        new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1)),
        new ExchangePosition('foobar2', new Position('BTCUSD2', 'long', 1))
      ],
      [
        new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1)),
        new ExchangePosition('foobar2', new Position('BTCUSD2', 'long', 1))
      ],
      [
        new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1)),
        new ExchangePosition('foobar2', new Position('BTCUSD2', 'long', 1))
      ]
    ];

    let i = 0;
    const events = {};
    const exchangeManager = new ExchangePositionWatcher(
      {
        getPositions: async () => {
          return runs[i++];
        }
      },
      {
        emit: (eventName, event) => {
          events[eventName] = event;
        }
      },
      { info: () => {} }
    );

    await exchangeManager.onPositionStateChangeTick();
    await exchangeManager.onPositionStateChangeTick();
    await exchangeManager.onPositionStateChangeTick();

    assert.strictEqual(Object.keys(events).length, 0);
  });

  it('test that opened, closed, reopen positions are triggered', async () => {
    const runs = [
      [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1))],
      [],
      [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1))]
    ];

    let i = 0;
    const events = [];
    const exchangeManager = new ExchangePositionWatcher(
      {
        getPositions: async () => {
          return runs[i++];
        }
      },
      {
        emit: (eventName, event) => {
          events.push(event);
        }
      },
      { info: () => {} }
    );

    await exchangeManager.onPositionStateChangeTick();
    assert.strictEqual(Object.keys(exchangeManager.positions).length, 1);

    await exchangeManager.onPositionStateChangeTick();
    assert.strictEqual(Object.keys(exchangeManager.positions).length, 0);

    await exchangeManager.onPositionStateChangeTick();
    assert.strictEqual(Object.keys(exchangeManager.positions).length, 1);

    const eventClosed = events[0];
    assert.strictEqual(eventClosed.getExchange(), 'foobar');
    assert.strictEqual(eventClosed.getSymbol(), 'BTCUSD');
    assert.strictEqual(eventClosed.isOpened(), false);
    assert.strictEqual(eventClosed.isClosed(), true);
    assert.strictEqual(eventClosed.getPosition().symbol, 'BTCUSD');

    const eventOpen = events[1];
    assert.strictEqual(eventOpen.getExchange(), 'foobar');
    assert.strictEqual(eventOpen.getSymbol(), 'BTCUSD');
    assert.strictEqual(eventOpen.isOpened(), true);
    assert.strictEqual(eventOpen.isClosed(), false);
    assert.strictEqual(eventOpen.getPosition().symbol, 'BTCUSD');
  });
});
