let assert = require('assert')
let StopLossCalculator = require('../../../modules/order/stop_loss_calculator')
let Position = require('../../../dict/position')
let Ticker = require('../../../dict/ticker')
let Tickers = require('../../../storage/tickers')
const { createLogger } = require('winston')
let fs = require('fs');

describe('#stop loss order calculation', function() {
    it('calculate stop lose for long', async () => {
        let tickers = new Tickers()
        tickers.set(new Ticker('noop', 'BTCUSD', undefined, 6500.66, 6502.99))

        let calculator = new StopLossCalculator(tickers, createLogger({
            transports : [new (require('winston')).transports.Stream({
                stream: fs.createWriteStream('/dev/null')
            })],
        }))

        let result = await calculator.calculateForOpenPosition('noop', new Position(
            'BTCUSD',
            'long',
            0.15,
            6500.66,
            new Date(),
            6501.76
        ))

        assert.equal(result.toFixed(1), 6306.7)
    })

    it('calculate stop lose for short', async () => {
        let tickers = new Tickers()
        tickers.set(new Ticker('noop', 'BTCUSD', undefined, 6500.66, 6502.99))

        let calculator = new StopLossCalculator(tickers, createLogger({
            transports : [new (require('winston')).transports.Stream({
                stream: fs.createWriteStream('/dev/null')
            })],
        }))

        let result = await calculator.calculateForOpenPosition('noop', new Position(
            'BTCUSD',
            'short',
            -0.15,
            6500.66,
            new Date(),
            6501.76
        ))

        assert.equal(result.toFixed(1), 6696.8)
    })

    it('calculate stop lose invalid option', async () => {
        let tickers = new Tickers()
        tickers.set(new Ticker('noop', 'BTCUSD', undefined, 6500.66, 6502.99))

        let calculator = new StopLossCalculator(tickers, createLogger({
            transports : [new (require('winston')).transports.Stream({
                stream: fs.createWriteStream('/dev/null')
            })],
        }))

        let result = await calculator.calculateForOpenPosition('noop', new Position(
            'BTCUSD',
            'short',
            -0.15,
            6500.66,
            new Date(),
            6501.76
        ), {})

        assert.equal(result, undefined)
    })

    it('calculate stop lose with higher ticker (long)', async () => {
        let tickers = new Tickers()
        tickers.set(new Ticker('noop', 'BTCUSD', undefined, 6500.66, 6301))

        let calculator = new StopLossCalculator(tickers, createLogger({
            transports : [new (require('winston')).transports.Stream({
                stream: fs.createWriteStream('/dev/null')
            })],
        }))

        let result = await calculator.calculateForOpenPosition('noop', new Position(
            'BTCUSD',
            'long',
            0.15,
            6500.66,
            new Date(),
            6501.76
        ))

        assert.equal(result, undefined)
    })

    it('calculate stop lose with higher ticker (short)', async () => {
        let tickers = new Tickers()
        tickers.set(new Ticker('noop', 'BTCUSD', undefined, 6796, 6502.99))

        let calculator = new StopLossCalculator(tickers, createLogger({
            transports : [new (require('winston')).transports.Stream({
                stream: fs.createWriteStream('/dev/null')
            })],
        }))

        let result = await calculator.calculateForOpenPosition('noop', new Position(
            'BTCUSD',
            'short',
            -0.15,
            6500.66,
            new Date(),
            6501.76
        ))

        assert.equal(result, undefined)
    })
})
