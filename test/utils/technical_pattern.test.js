const assert = require('assert');
const fs = require('fs');
const TechnicalPattern = require('../../src/utils/technical_pattern');

describe('#technical pattern', () => {
  it('pump it with volume', () => {
    const candles = createCandleFixtures()
      .slice()
      .reverse();

    const results = [];
    for (let i = 40; i < candles.length; i++) {
      results.push(TechnicalPattern.volumePump(candles.slice(0, i)));
    }

    const success = results.filter(r => r.hint === 'success');

    assert.equal(success[0].price_trigger.toFixed(3), 15.022);
  });

  let createCandleFixtures = function() {
    return JSON.parse(fs.readFileSync(`${__dirname}/fixtures/pattern/volume_pump_BNBUSDT.json`, 'utf8'));
  };
});
