const assert = require('assert');
const fs = require('fs');
const BinanceMargin = require('../../exchange/binance_margin');
const Order = require('../../dict/order');
const Position = require('../../dict/position');
const Ticker = require('../../dict/ticker');
const ExchangeOrder = require('../../dict/exchange_order');

describe('#binance_margin exchange implementation', function() {
  const getFixtures = function(file) {
    return JSON.parse(fs.readFileSync(`${__dirname}/binance_margin/${file}.json`, 'utf8'));
  };

  it('account balances is extracted', async () => {
    const binanceMargin = new BinanceMargin(undefined, {
      debug: () => {}
    });

    binanceMargin.client = {
      marginAccountInfo: async () => {
        return { userAssets: getFixtures('account_info') };
      }
    };

    await binanceMargin.syncBalances();

    const { balances } = binanceMargin;

    const VET = balances.find(b => b.asset === 'VET');
    assert.strictEqual(parseFloat(VET.available.toFixed(0)), -657);
    assert.strictEqual(parseFloat(VET.netAsset.toFixed(0)), -657);

    const BTC = balances.find(b => b.asset === 'BTC');
    assert.strictEqual(parseFloat(BTC.available.toFixed(5)), 0.05124);
    assert.strictEqual(parseFloat(BTC.netAsset.toFixed(5)), 0.13403);

    const BAT = balances.find(b => b.asset === 'BAT');
    assert.strictEqual(parseFloat(BAT.available.toFixed(2)), 2089.96);
    assert.strictEqual(parseFloat(BAT.netAsset.toFixed(2)), 2088.64);

    const ADA = balances.find(b => b.asset === 'ADA');
    assert.strictEqual(parseFloat(ADA.available.toFixed(2)), 9505.7);
    assert.strictEqual(parseFloat(ADA.netAsset.toFixed(2)), 9501.2);
  });
});
