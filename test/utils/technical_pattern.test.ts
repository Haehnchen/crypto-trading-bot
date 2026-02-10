import assert from 'assert';
import fs from 'fs';
import * as path from 'path';
import * as TechnicalPattern from '../../src/utils/technical_pattern';

interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

describe('#technical pattern', () => {
  it('pump it with volume', () => {
    const candles = createCandleFixtures()
      .slice()
      .reverse();

    const results: TechnicalPattern.VolumePumpResult[] = [];
    for (let i = 40; i < candles.length; i++) {
      results.push(TechnicalPattern.volumePump(candles.slice(0, i)));
    }

    const success = results.filter(r => r.hint === 'success');

    assert.equal(success[0].price_trigger?.toFixed(3), '15.022');
  });

  function createCandleFixtures(): Candlestick[] {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/pattern/volume_pump_BNBUSDT.json'), 'utf8'));
  }
});
