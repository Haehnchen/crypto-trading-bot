let assert = require('assert')
let ExchangeOrderWatchdogListener = require('../../../modules/listener/exchange_order_watchdog_listener')
let Ticker = require('../../../dict/ticker')
let Position = require('../../../dict/position')
let SignalResult = require('../../../modules/strategy/dict/signal_result')

describe('#watchdogs are working', () => {
    it('watchdog for stoploss is working (long)', async () => {
        let calls = []

        let listener = new ExchangeOrderWatchdogListener(
            {},
            {},
            {},
            {},
            {},
            {'update': async (exchange, symbol, state) => { calls.push(exchange, symbol, state) }},
            {'info': () => {}},
            {'get': () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101)},
        )

        let exchange = {'getName': () => 'foobar'}

        await listener.stoplossWatch(exchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {'stop': 0.9})

        assert.deepEqual(calls, ['foobar', 'FOOUSD', 'close'])
    })

    it('watchdog for stoploss is working (long) but valid', async () => {
        let calls = []

        let listener = new ExchangeOrderWatchdogListener(
            {},
            {},
            {},
            {},
            {},
            {'update': async (exchange, symbol, state) => { calls.push(exchange, symbol, state) }},
            {'info': () => {}},
            {'get': () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101)},
        )

        let exchange = {'getName': () => 'foobar'}

        await listener.stoplossWatch(exchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {'stop': 1.9})

        assert.deepEqual(calls, [])
    })

    it('watchdog for stoploss is working (long) profitable', async () => {
        let calls = []

        let listener = new ExchangeOrderWatchdogListener(
            {},
            {},
            {},
            {},
            {},
            {'update': async (exchange, symbol, state) => { calls.push(exchange, symbol, state) }},
            {'info': () => {}},
            {'get': () => new Ticker('foobar', 'BTCUSD', undefined, 100, 101)},
        )

        let exchange = {'getName': () => 'foobar'}

        await listener.stoplossWatch(exchange, new Position('FOOUSD', 'long', 1, undefined, undefined, 100), {'stop': 0.9})

        assert.deepEqual(calls, [])
    })

    it('watchdog for stoploss is working (short)', async () => {
        let calls = []

        let listener = new ExchangeOrderWatchdogListener(
            {},
            {},
            {},
            {},
            {},
            {'update': async (exchange, symbol, state) => { calls.push(exchange, symbol, state) }},
            {'info': () => {}},
            {'get': () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101)},
        )

        let exchange = {'getName': () => 'foobar'}

        await listener.stoplossWatch(exchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {'stop': 0.9})

        assert.deepEqual(calls, ['foobar', 'FOOUSD', 'close'])
    })

    it('watchdog for stoploss is working (short) but valid', async () => {
        let calls = []

        let listener = new ExchangeOrderWatchdogListener(
            {},
            {},
            {},
            {},
            {},
            {'update': async (exchange, symbol, state) => { calls.push(exchange, symbol, state) }},
            {'info': () => {}},
            {'get': () => new Ticker('foobar', 'BTCUSD', undefined, 99, 101)},
        )

        let exchange = {'getName': () => 'foobar'}

        await listener.stoplossWatch(exchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {'stop': 1.1})

        assert.deepEqual(calls, [])
    })

    it('watchdog for stoploss is working (short) profitable', async () => {
        let calls = []

        let listener = new ExchangeOrderWatchdogListener(
            {},
            {},
            {},
            {},
            {},
            {'update': async (exchange, symbol, state) => { calls.push(exchange, symbol, state) }},
            {'info': () => {}},
            {'get': () => new Ticker('foobar', 'BTCUSD', undefined, 98, 99)},
        )

        let exchange = {'getName': () => 'foobar'}

        await listener.stoplossWatch(exchange, new Position('FOOUSD', 'short', -1, undefined, undefined, 100), {'stop': 0.9})

        assert.deepEqual(calls, [])
    })
})
