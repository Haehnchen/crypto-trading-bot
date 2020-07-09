const assert = require('assert');
const fs = require('fs');
const BinanceFutures = require('../../src/exchange/binance_futures');
const Position = require('../../src/dict/position');

describe('#binance_futures exchange implementation', () => {
  const getJsonFixture = filename => {
    return JSON.parse(fs.readFileSync(`${__dirname}/binance_futures/${filename}`, 'utf8'));
  };

  it('calculates positions', () => {
    const positions = BinanceFutures.createPositions(getJsonFixture('positions.json'));

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

  it('websocket position close positions', async () => {
    const binanceFutures = new BinanceFutures({}, {}, {}, { info: () => {} }, {}, {});

    binanceFutures.positions = {
      EOSUSDT: new Position('EOSUSDT', 'long', 1),
      ADAUSDT: new Position('ADAUSDT', 'long', 1)
    };

    const json = getJsonFixture('websocket_position_close.json');
    binanceFutures.accountUpdate(json);

    assert.strictEqual((await binanceFutures.getPositions()).length, 1);
  });
});
