let assert = require('assert');
let StrategyManager = require('../../strategy/strategy_manager');
let fs = require('fs');

describe('#strategy manager', () => {
    it('strategy cci', async () => {
        let strategyManager = new StrategyManager(createCandlestickRepository())

        let result = await strategyManager.executeStrategy('cci', 6000, 'foobar', 'BTCUSD', {'period': '15m'})
        assert.equal(undefined, result['signal'])
    });

    it('strategy macd', async () => {
        let strategyManager = new StrategyManager(createCandlestickRepository())

        let result = await strategyManager.executeStrategy('macd', 6000, 'foobar', 'BTCUSD', {'period': '15m'})
        assert.equal(undefined, result['signal'])
    });

    var createCandlestickRepository = () => {
        return {
            getLookbacksForPair: () => {
                return new Promise((resolve) => { resolve(createCandleFixtures()) })
            }
        }
    }

    var createCandleFixtures = () => {
        return JSON.parse(fs.readFileSync(__dirname + '/../utils/fixtures/xbt-usd-5m.json', 'utf8'));
    }
});
