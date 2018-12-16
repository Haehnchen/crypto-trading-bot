let assert = require('assert')
let RiskRewardRatioCalculator = require('../../../modules/order/risk_reward_ratio_calculator')
let Position = require('../../../dict/position')
let ExchangeOrder = require('../../../dict/exchange_order')
const { createLogger } = require('winston')
let fs = require('fs');

describe('#risk reward order calculation', function() {
    it('calculate risk reward orders for long', async () => {
        let calculator = new RiskRewardRatioCalculator(createLoggerInstance())

        let result = await calculator.calculateForOpenPosition(new Position(
            'BTCUSD',
            'long',
            0.15,
            0,
            new Date(),
            6501.76
        ))

        assert.equal(result.stop.toFixed(1), 6306.7)
        assert.equal(result.target.toFixed(1), 6891.9)

        result = await calculator.calculateForOpenPosition(new Position(
            'BTCUSD',
            'long',
            0.15,
            0,
            new Date(),
            6501.76
        ), {'stop_percent': 0.5, 'target_percent': 0.25})

        assert.equal(result.stop.toFixed(1), 6469.3)
        assert.equal(result.target.toFixed(1), 6518.0)
    })

    it('calculate risk reward orders for short', async () => {
        let calculator = new RiskRewardRatioCalculator(createLoggerInstance())

        let result = await calculator.calculateForOpenPosition(new Position(
            'BTCUSD',
            'short',
            -0.15,
            0,
            new Date(),
            6501.76
        ))

        assert.equal(result.stop.toFixed(1), 6696.8)
        assert.equal(result.target.toFixed(1), 6111.7)

        result = await calculator.calculateForOpenPosition(new Position(
            'BTCUSD',
            'short',
            -0.15,
            0,
            new Date(),
            6501.76
        ), {'stop_percent': 0.5, 'target_percent': 0.25})

        assert.equal(result.stop.toFixed(1), 6534.3)
        assert.equal(result.target.toFixed(1), 6485.5)
    })

    it('create risk reward ratio changeset orders (long)', async () => {
        let calculator = new RiskRewardRatioCalculator(createLoggerInstance())

        let position = new Position(
            'BTCUSD',
            'long',
            0.15,
            0,
            new Date(),
            6501.76
        );

        let result = await calculator.syncRatioRewardOrders(position, [], {'stop_percent': 0.5, 'target_percent': 0.25})

        assert.deepEqual(result['stop'], { amount: 0.15, price: -6469.251200000001 })
        assert.deepEqual(result['target'], { amount: 0.15, price: -6518.0144 })

        // target create
        assert.deepEqual(await calculator.syncRatioRewardOrders(
            position,
            [new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'stop')],
            {'stop_percent': 0.5, 'target_percent': 0.25}
        ), {
            "target": {
                "amount": 0.15,
                "price": -6518.0144
            }
        })

        // stop create
        assert.deepEqual(await calculator.syncRatioRewardOrders(
            position,
            [new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'limit')],
            {'stop_percent': 0.5, 'target_percent': 0.25}
        ), {
            "stop": {
                "amount": 0.15,
                "price": -6469.251200000001
            }
        })
    })

    it('create risk reward ratio changeset orders (short)', async () => {
        let calculator = new RiskRewardRatioCalculator(createLoggerInstance())

        let position = new Position(
            'BTCUSD',
            'short',
            -0.15,
            0,
            new Date(),
            6501.76
        );

        let result = await calculator.syncRatioRewardOrders(position, [], {'stop_percent': 0.5, 'target_percent': 0.25})

        assert.deepEqual(result['stop'], { amount: 0.15, price: 6534.2688 })
        assert.deepEqual(result['target'], { amount: 0.15, price: 6485.5056 })

        // target create
        assert.deepEqual(await calculator.syncRatioRewardOrders(
            position,
            [new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'stop')],
            {'stop_percent': 0.5, 'target_percent': 0.25}
        ), {
            "target": {
                "amount": 0.15,
                "price": 6485.5056
            }
        })

        // stop create
        assert.deepEqual(await calculator.syncRatioRewardOrders(
            position,
            [new ExchangeOrder('foobar', 'BTUSD', 'open', 1337, 3, false, 'our_id', 'buy', 'limit')],
            {'stop_percent': 0.5, 'target_percent': 0.25}
        ), {
            "stop": {
                "amount": 0.15,
                "price": 6534.2688
            }
        })
    })

    it('create risk reward ratio orders (long)', async () => {
        let calculator = new RiskRewardRatioCalculator(createLoggerInstance())

        let position = new Position(
            'BTCUSD',
            'long',
            0.15,
            0,
            new Date(),
            6501.76
        );

        let orders = await calculator.createRiskRewardOrdersOrders(position, [], {'stop_percent': 0.5, 'target_percent': 0.25})

        assert.deepEqual(orders.find(order => order.type === 'limit').price, -6518.0144)
        assert.deepEqual(orders.find(order => order.type === 'stop').price, -6469.251200000001)
    })

    it('create risk reward ratio orders (short)', async () => {
        let calculator = new RiskRewardRatioCalculator(createLoggerInstance())

        let position = new Position(
            'BTCUSD',
            'short',
            -0.15,
            0,
            new Date(),
            6501.76
        );

        let orders = await calculator.createRiskRewardOrdersOrders(position, [], {'stop_percent': 0.5, 'target_percent': 0.25})

        assert.deepEqual(orders.find(order => order.type === 'limit').price, 6485.5056)
        assert.deepEqual(orders.find(order => order.type === 'stop').price, 6534.2688)
    })

    function createLoggerInstance() {
        return createLogger({
            transports: [new (require('winston')).transports.Stream({
                stream: fs.createWriteStream('/dev/null')
            })],
        });
    }
})
