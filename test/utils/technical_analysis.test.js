let assert = require('assert');
let ta = require('../../utils/technical_analysis');

let fs = require('fs');

describe('#technical_analysis for candles', () => {
    it('technical_analysis for candles are returned', async () => {
        const result = await ta.getIndicatorsLookbacks(createCandleFixtures());

        assert.equal(490, result['ema_55'].length)
    });

    var createCandleFixtures = function() {
        return JSON.parse(fs.readFileSync(__dirname + '/fixtures/xbt-usd-5m.json', 'utf8'));
    }
});
