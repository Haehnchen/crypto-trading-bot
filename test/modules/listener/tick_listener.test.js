let assert = require('assert')
let TickListener = require('../../../modules/listener/tick_listener')
let Ticker = require('../../../dict/ticker')
let SignalResult = require('../../../modules/strategy/dict/signal_result')

describe('#tick listener for order', function() {
    it('test tick listener for live order', async () => {

        let updates = []

        let listener = new TickListener(
            {'get': () => new Ticker()},
            {},
            {'send': () => {}},
            {'signal': () => {}},
            {
                'executeStrategy': async () => {
                    return SignalResult.createSignal('short', {})
                }
            },
            {
                'getPosition': async () => {
                    return []
                }
            },
            {'update': async (exchange, symbol, signal) => {
                updates.push(exchange, symbol, signal)
                return []
            }},
            {'info': () => {}},
        )

        await listener.visitTradeStrategy('foobar', {
            'symbol': 'FOOUSD',
            'exchange': 'FOOBAR',
        })

        assert.deepEqual(['FOOBAR', 'FOOUSD', 'short'], updates)


        // reset; block for time window
        updates = []
        await listener.visitTradeStrategy('foobar', {
            'symbol': 'FOOUSD',
            'exchange': 'FOOBAR',
        })

        assert.deepEqual([], updates)
    })

    it('test tick listener for notifier order', async () => {
        let calls = []

        let listener = new TickListener(
            {'get': () => new Ticker()},
            {},
            {'send': () => {}},
            {
                'signal': (exchange, symbol, opts, signal, strategyKey) => {
                    calls.push(exchange, symbol, opts, signal, strategyKey)
                    return []
                }
            },
            {
                'executeStrategy': async () => {
                    return SignalResult.createSignal('short', {})
                }
            },
            {
                'getPosition': async () => {
                    return []
                }
            },
            {},
            {'info': () => {}},
        )

        await listener.visitStrategy({'strategy': 'foobar'}, {
            'symbol': 'FOOUSD',
            'exchange': 'FOOBAR',
        })

        assert.deepEqual(
            calls,
            [
                'FOOBAR',
                'FOOUSD',
                { price: undefined,
                    strategy: 'foobar',
                    raw: '{"_debug":{},"_signal":"short"}'
                },
                'short',
                'foobar'
            ]
        )
    })
})
