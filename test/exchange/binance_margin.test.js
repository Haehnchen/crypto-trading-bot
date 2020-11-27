const assert = require('assert');
const fs = require('fs');
const moment = require('moment');
const BinanceMargin = require('../../src/exchange/binance_margin');
const Ticker = require('../../src/dict/ticker');
const Order = require('../../src/dict/order');
const ExchangeOrder = require('../../src/dict/exchange_order');

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

    const BTC = balances.find(b => b.asset === 'BTC');
    assert.strictEqual(parseFloat(BTC.available.toFixed(5)), 0.13403);

    const BAT = balances.find(b => b.asset === 'BAT');
    assert.strictEqual(parseFloat(BAT.available.toFixed(2)), 2088.64);

    const ADA = balances.find(b => b.asset === 'ADA');
    assert.strictEqual(parseFloat(ADA.available.toFixed(2)), 9501.2);
  });

  it('test that positions are open based on websocket balances', async () => {
    const binance = new BinanceMargin(
      undefined,
      { debug: () => {} },
      {
        addQueue2: async p => {
          await p();
        }
      }
    );

    binance.symbols = [
      {
        symbol: 'XRPUSDC',
        trade: {
          capital: 3000
        }
      },
      {
        symbol: 'XRPUSDT',
        trade: {
          capital: 3000
        }
      },
      {
        symbol: 'XRPBUSD',
        trade: {
          capital: 3000
        }
      }
    ];

    binance.tickers.XRPUSDT = new Ticker('foobar', 'XRPUSDT', undefined, 0.25429, 0.26429);

    binance.client = {
      marginAllOrders: async opts => {
        const newVar = {
          XRPUSDT: [
            {
              clientOrderId: 'web_2e31730aa5814006a6295c1779a68eab',
              cummulativeQuoteQty: '499.97581200',
              executedQty: '1822.80000000',
              icebergQty: '0.00000000',
              isWorking: true,
              orderId: 278520093,
              origQty: '1822.80000000',
              price: '0.27429000',
              side: 'SELL',
              status: 'FILLED',
              stopPrice: '0.00000000',
              symbol: 'XRPUSDT',
              time: new Date(),
              timeInForce: 'GTC',
              type: 'LIMIT',
              updateTime: 1571933622396
            }
          ],
          XRPUSDC: [
            {
              clientOrderId: 'web_2e31730aa5814006a6295c1779a68eab',
              cummulativeQuoteQty: '499.97581200',
              executedQty: '1822.80000000',
              icebergQty: '0.00000000',
              isWorking: true,
              orderId: 278520093,
              origQty: '1822.80000000',
              price: '0.27429000',
              side: 'SELL',
              status: 'FILLED',
              stopPrice: '0.00000000',
              symbol: 'XRPUSDT',
              time: new Date(moment().subtract(1, 'hour')),
              timeInForce: 'GTC',
              type: 'LIMIT',
              updateTime: 1571933622396
            }
          ]
        };

        return newVar[opts.symbol] || [];
      },
      marginAccountInfo: async () => {
        return {
          userAssets: [
            {
              asset: 'XRP',
              borrowed: '3000',
              free: '0.00000000',
              interest: '0.00000221',
              locked: '0.00000000',
              netAsset: '-3000'
            }
          ]
        };
      }
    };

    await binance.syncBalances();
    await binance.syncTradesForEntries();

    const positions = await binance.getPositions();
    assert.equal(positions.length, 1);

    const XRPUSDT = await binance.getPositionForSymbol('XRPUSDT');

    assert.equal(XRPUSDT.amount, -3000);
    assert.equal(XRPUSDT.profit > 7 && XRPUSDT.profit < 8, true);
  });

  it('test that order payload for borrow and lending is generated for no position', async () => {
    const binance = new BinanceMargin(undefined, { debug: () => {} });

    let myOrder;
    binance.client = {
      marginOrder: async order => {
        myOrder = order;

        return {
          symbol: 'FOOUSD',
          orderId: 3278332213,
          clientOrderId: 'web_f4ab3eae12844370a056685f0e52617e_REST',
          price: '10400',
          origQty: '0.000962',
          status: 'NEW',
          type: 'LIMIT',
          side: 'BUY',
          time: 1601049698994,
          updateTime: 1601049698994
        };
      }
    };

    await binance.order(Order.createLimitPostOnlyOrder('BTCUSD', Order.SIDE_SHORT, 6666, 1));
    assert.strictEqual(myOrder.sideEffectType, 'MARGIN_BUY');
  });

  it('test that order payload for borrow and lending is generated for short position', async () => {
    const binance = new BinanceMargin(undefined, { debug: () => {} });

    binance.symbols = [
      {
        symbol: 'XRPUSDT',
        trade: {
          capital: 3000
        }
      }
    ];

    let myOrder;
    binance.client = {
      marginOrder: async order => {
        myOrder = order;

        return {
          symbol: 'FOOUSD',
          orderId: 25035356,
          clientOrderId: 'web_f4ab3eae12844370a056685f0e52617e_REST',
          price: '10400',
          origQty: '0.000962',
          status: 'NEW',
          type: 'LIMIT',
          side: 'SELL',
          time: 1601049698994,
          updateTime: 1601049698994
        };
      },
      marginAllOrders: async opts => {
        const newVar = {
          XRPUSDT: [
            {
              clientOrderId: 'web_2e31730aa5814006a6295c1779a68eab',
              cummulativeQuoteQty: '499.97581200',
              executedQty: '1822.80000000',
              icebergQty: '0.00000000',
              isWorking: true,
              orderId: 278520093,
              origQty: '1822.80000000',
              price: '0.27429000',
              side: 'SELL',
              status: 'FILLED',
              stopPrice: '0.00000000',
              symbol: 'XRPUSDT',
              time: new Date(),
              timeInForce: 'GTC',
              type: 'LIMIT',
              updateTime: 1571933622396
            }
          ]
        };

        return newVar[opts.symbol] || [];
      },
      marginAccountInfo: async () => {
        return {
          userAssets: [
            {
              asset: 'XRP',
              borrowed: '3000',
              free: '0.00000000',
              interest: '0.00000221',
              locked: '0.00000000',
              netAsset: '-3000'
            }
          ]
        };
      }
    };

    await binance.syncBalances();
    await binance.syncTradesForEntries();

    const positions = await binance.getPositions();
    assert.strictEqual(positions.length, 1);

    // close position
    await binance.order(Order.createLimitPostOnlyOrder('XRPUSDT', Order.SIDE_LONG, 6666, 1));
    assert.strictEqual(myOrder.sideEffectType, 'AUTO_REPAY');

    // add to position
    await binance.order(Order.createLimitPostOnlyOrder('XRPUSDT', Order.SIDE_SHORT, 6666, 1));
    assert.strictEqual(myOrder.sideEffectType, 'MARGIN_BUY');
  });

  it('test that order payload for borrow and lending is generated for long position', async () => {
    const binance = new BinanceMargin(undefined, { debug: () => {} });

    binance.symbols = [
      {
        symbol: 'XRPUSDT',
        trade: {
          capital: 3000
        }
      }
    ];

    let myOrder;
    binance.client = {
      marginOrder: async order => {
        myOrder = order;

        return {
          symbol: 'FOOUSD',
          orderId: 25035356,
          clientOrderId: 'web_f4ab3eae12844370a056685f0e52617e_REST',
          price: '10400',
          origQty: '0.000962',
          status: 'NEW',
          type: 'LIMIT',
          side: 'BUY',
          time: 1601049698994,
          updateTime: 1601049698994
        };
      },
      marginAllOrders: async opts => {
        const newVar = {
          XRPUSDT: [
            {
              clientOrderId: 'web_2e31730aa5814006a6295c1779a68eab',
              cummulativeQuoteQty: '499.97581200',
              executedQty: '1822.80000000',
              icebergQty: '0.00000000',
              isWorking: true,
              orderId: 278520093,
              origQty: '1822.80000000',
              price: '0.27429000',
              side: 'BUY',
              status: 'FILLED',
              stopPrice: '0.00000000',
              symbol: 'XRPUSDT',
              time: new Date(),
              timeInForce: 'GTC',
              type: 'LIMIT',
              updateTime: 1571933622396
            }
          ]
        };

        return newVar[opts.symbol] || [];
      },
      marginAccountInfo: async () => {
        return {
          userAssets: [
            {
              asset: 'XRP',
              borrowed: '3000',
              free: '0.00000000',
              interest: '0.00000221',
              locked: '0.00000000',
              netAsset: '3000'
            }
          ]
        };
      }
    };

    await binance.syncBalances();
    await binance.syncTradesForEntries();

    const positions = await binance.getPositions();
    assert.strictEqual(positions.length, 1);

    // close position
    await binance.order(Order.createLimitPostOnlyOrder('XRPUSDT', Order.SIDE_LONG, 6666, 1));
    assert.strictEqual(myOrder.sideEffectType, 'MARGIN_BUY');

    // add to position
    await binance.order(Order.createLimitPostOnlyOrder('XRPUSDT', Order.SIDE_SHORT, 6666, 1));
    assert.strictEqual(myOrder.sideEffectType, 'AUTO_REPAY');
  });
});
