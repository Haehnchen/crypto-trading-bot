let assert = require('assert');
let ta = require('../../utils/technical_analysis');

let fs = require('fs');

describe('#technical_analysis for candles', () => {
    it('technical_analysis for candles are returned', async () => {
        const result = await ta.getIndicatorsLookbacks(createCandleFixtures().reverse());

        assert.equal(490, result['ema_55'].length)
    });

    it('technical_analysis for bollinger percent', () => {
        assert.equal(-20, ta.getBollingerBandPrice(80, 200, 100))
        assert.equal(120, ta.getBollingerBandPrice(220, 200, 100))
        assert.equal(50, ta.getBollingerBandPrice(150, 200, 100))
        assert.equal(-25, ta.getBollingerBandPrice(75, 200, 100))
    });

    var createCandleFixtures = function() {
        return JSON.parse(fs.readFileSync(__dirname + '/fixtures/xbt-usd-5m.json', 'utf8'));
    }
});
