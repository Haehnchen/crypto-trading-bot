let assert = require('assert');
let ExchangePositionWatcher = require('../../../modules/exchange/exchange_position_watcher');
let ExchangePosition = require('../../../dict/exchange_position');
let PositionStateChangeEvent = require('../../../event/position_state_change_event');
let Position = require('../../../dict/position');

describe('#exchange position watcher', () => {
    it('test that opened positions are triggered', async () => {
        let runs =
            [
                [],
                [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1))]
            ];

        let i = 0
        let events = {}
        let exchangeManager = new ExchangePositionWatcher(
            {
                'getPositions': async () => {
                    return runs[i++]
                }
            },
            {'emit': (eventName, event) => {
                    events[eventName] = event
                }},
            {'info': () => {}},
        );

        await exchangeManager.onPositionStateChangeTick()
        await exchangeManager.onPositionStateChangeTick()

        assert.strictEqual(Object.keys(exchangeManager.positions).length, 1)

        let event = events[PositionStateChangeEvent.EVENT_NAME];
        assert.strictEqual(event.getExchange(), 'foobar')
        assert.strictEqual(event.getSymbol(), 'BTCUSD')
        assert.strictEqual(event.isOpened(), true)
        assert.strictEqual(event.isClosed(), false)

        let position = event.getPosition();

        assert.strictEqual(position.symbol, 'BTCUSD')
    })

    it('test that closed positions are triggered', async () => {
        let runs =
            [
                [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1))],
                [],
            ];

        let i = 0
        let events = {}
        let exchangeManager = new ExchangePositionWatcher(
            {
                'getPositions': async () => {
                    return runs[i++]
                }
            },
            {'emit': (eventName, event) => {
                    events[eventName] = event
                }},
            {'info': () => {}},
        );

        await exchangeManager.onPositionStateChangeTick()
        await exchangeManager.onPositionStateChangeTick()

        assert.strictEqual(Object.keys(exchangeManager.positions).length, 0)

        let event = events[PositionStateChangeEvent.EVENT_NAME];
        assert.strictEqual(event.getExchange(), 'foobar')
        assert.strictEqual(event.getSymbol(), 'BTCUSD')
        assert.strictEqual(event.isOpened(), false)
        assert.strictEqual(event.isClosed(), true)

        let position = event.getPosition();

        assert.strictEqual(position.symbol, 'BTCUSD')
    })

    it('test that no change should not trigger event', async () => {
        let runs =
            [
                [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1)), new ExchangePosition('foobar2', new Position('BTCUSD2', 'long', 1))],
                [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1)), new ExchangePosition('foobar2', new Position('BTCUSD2', 'long', 1))],
                [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1)), new ExchangePosition('foobar2', new Position('BTCUSD2', 'long', 1))],
            ];

        let i = 0
        let events = {}
        let exchangeManager = new ExchangePositionWatcher(
            {
                'getPositions': async () => {
                    return runs[i++]
                }
            },
            {'emit': (eventName, event) => {
                    events[eventName] = event
                }},
            {'info': () => {}},
        );

        await exchangeManager.onPositionStateChangeTick()
        await exchangeManager.onPositionStateChangeTick()
        await exchangeManager.onPositionStateChangeTick()

        assert.strictEqual(Object.keys(events).length, 0)
    })

    it('test that opened, closed, reopen positions are triggered', async () => {
        let runs =
            [
                [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1))],
                [],
                [new ExchangePosition('foobar', new Position('BTCUSD', 'long', 1))],
            ];

        let i = 0
        let events = []
        let exchangeManager = new ExchangePositionWatcher(
            {
                'getPositions': async () => {
                    return runs[i++]
                }
            },
            {   'emit': (eventName, event) => {
                    events.push(event)
                }
            },
            {'info': () => {}},
        );

        await exchangeManager.onPositionStateChangeTick()
        assert.strictEqual(Object.keys(exchangeManager.positions).length, 1)

        await exchangeManager.onPositionStateChangeTick()
        assert.strictEqual(Object.keys(exchangeManager.positions).length, 0)

        await exchangeManager.onPositionStateChangeTick()
        assert.strictEqual(Object.keys(exchangeManager.positions).length, 1)

        let eventClosed = events[0]
        assert.strictEqual(eventClosed.getExchange(), 'foobar')
        assert.strictEqual(eventClosed.getSymbol(), 'BTCUSD')
        assert.strictEqual(eventClosed.isOpened(), false)
        assert.strictEqual(eventClosed.isClosed(), true)
        assert.strictEqual(eventClosed.getPosition().symbol, 'BTCUSD')

        let eventOpen = events[1]
        assert.strictEqual(eventOpen.getExchange(), 'foobar')
        assert.strictEqual(eventOpen.getSymbol(), 'BTCUSD')
        assert.strictEqual(eventOpen.isOpened(), true)
        assert.strictEqual(eventOpen.isClosed(), false)
        assert.strictEqual(eventOpen.getPosition().symbol, 'BTCUSD')
    })
})
