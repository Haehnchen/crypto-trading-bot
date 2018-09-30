let assert = require('assert');
let StrategyManager = require('../../strategy/strategy_manager');
let fs = require('fs');

describe('#strategy collection', () => {
    it('strategy cci short', async () => {
        let strategyManager = new StrategyManager()

        let result = await strategyManager.executeStrategy('cci', 6000, createCandleFixtures())

        assert.equal(undefined, result)
    });

    var createCandleFixtures = () => {
        return JSON.parse(fs.readFileSync(__dirname + '/../utils/fixtures/xbt-usd-5m.json', 'utf8'));
    }
});
