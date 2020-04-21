const assert = require('assert');
const fs = require('fs');
const BinanceFutures = require('../../src/exchange/binance_futures');

describe('#binance_futures exchange implementation', () => {
  const getPositions = () => {
    return JSON.parse(fs.readFileSync(`${__dirname}/binance_futures/positions.json`, 'utf8'));
  };

  it('calculates positions', () => {
    const positions = BinanceFutures.createPositions(getPositions());

    assert.strictEqual(positions[0].getSymbol(), 'ETHUSDT');
    assert.strictEqual(positions[0].isShort(), true);
    assert.strictEqual(positions[0].getAmount(), -2.349);
    assert.strictEqual(positions[0].getEntry(), 170.24);
    assert.strictEqual(positions[0].getRaw().symbol, 'ETHUSDT');

    // short
    assert.strictEqual(positions[0].getProfit(), -1.5);
    assert.strictEqual(positions[1].getProfit(), 10.07);

    // long
    assert.strictEqual(positions[2].getProfit(), 1.52);
    assert.strictEqual(positions[3].getProfit(), -9.15);
  });
});
