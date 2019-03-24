let assert = require('assert');
let TechnicalPattern = require('../../utils/technical_pattern')
let fs = require('fs')

describe('#technical pattern', () => {
    it('pump it with volume', () => {
        let candles = createCandleFixtures().slice().reverse()

        let results = []
        for (let i = 40; i < candles.length; i++) {
            results.push(TechnicalPattern.volumePump(candles.slice(0, i)))
        }

        let success = results.filter(r => r.hint === 'success')

        assert.equal(success[0].price_trigger.toFixed(3), 15.022)
    })

    let createCandleFixtures = function() {
        return JSON.parse(fs.readFileSync(__dirname + '/fixtures/pattern/volume_pump_BNBUSDT.json', 'utf8'));
    }
})
