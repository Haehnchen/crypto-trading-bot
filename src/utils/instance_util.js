const request = require('request');

module.exports = {
  /**
   * Init helper for Binance to fetch all USDT pairs
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitUsdT: async callback => {
    return new Promise(resolve => {
      request('https://api.binance.com/api/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        let content;
        try {
          content = JSON.parse(body);
        } catch (e) {
          console.log(`Binance init issues: ${String(e)} ${body}`);
          resolve([]);
          return;
        }

        if (!content.symbols) {
          console.log(`Binance symbol format issues: ${body}`);
          resolve([]);
          return;
        }

        content.symbols
          .filter(
            p =>
              ['USDT'].includes(p.quoteAsset) &&
              !['USDC', 'PAX', 'USDS', 'TUSD', 'BUSD'].includes(p.baseAsset) &&
              p.status.toLowerCase() === 'trading'
          )
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'binance'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  /**
   * Init helper for Binance to fetch all BUSD pairs
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitBusd: async callback => {
    return new Promise(resolve => {
      request('https://api.binance.com/api/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        let content;
        try {
          content = JSON.parse(body);
        } catch (e) {
          console.log(`Binance init issues: ${String(e)} ${body}`);
          resolve([]);
          return;
        }

        if (!content.symbols) {
          console.log(`Binance symbol format issues: ${body}`);
          resolve([]);
          return;
        }

        content.symbols
          .filter(
            p =>
              ['BUSD'].includes(p.quoteAsset) &&
              !['USDC', 'PAX', 'USDS', 'TUSD', 'USDT'].includes(p.baseAsset) &&
              p.status.toLowerCase() === 'trading'
          )
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'binance'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  /**
   * Init helper for Binance to fetch all BNB pairs
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitBNB: async callback => {
    return new Promise(resolve => {
      request('https://api.binance.com/api/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        let content;
        try {
          content = JSON.parse(body);
        } catch (e) {
          console.log(`Binance init issues: ${String(e)} ${body}`);
          resolve([]);
          return;
        }

        if (!content.symbols) {
          console.log(`Binance symbol format issues: ${body}`);
          resolve([]);
          return;
        }

        content.symbols
          .filter(
            p =>
              ['BNB'].includes(p.quoteAsset) &&
              !['BUSD', 'USDC', 'PAX', 'USDS', 'TUSD', 'USDT'].includes(p.baseAsset) &&
              p.status.toLowerCase() === 'trading'
          )
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'binance'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  /**
   * Init helper for Binance to fetch all BTC pairs
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitBTC: async callback => {
    return new Promise(resolve => {
      request('https://api.binance.com/api/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        let content;
        try {
          content = JSON.parse(body);
        } catch (e) {
          console.log(`Binance init issues: ${String(e)} ${body}`);
          resolve([]);
          return;
        }

        if (!content.symbols) {
          console.log(`Binance symbol format issues: ${body}`);
          resolve([]);
          return;
        }

        content.symbols
          .filter(
            p =>
              ['BTC'].includes(p.quoteAsset) &&
              !['BUSD', 'USDC', 'PAX', 'USDS', 'TUSD', 'USDT'].includes(p.baseAsset) &&
              p.status.toLowerCase() === 'trading'
          )
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'binance'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  /**
   * Init helper for Binance to fetch all ETH pairs
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitETH: async callback => {
    return new Promise(resolve => {
      request('https://api.binance.com/api/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        let content;
        try {
          content = JSON.parse(body);
        } catch (e) {
          console.log(`Binance init issues: ${String(e)} ${body}`);
          resolve([]);
          return;
        }

        if (!content.symbols) {
          console.log(`Binance symbol format issues: ${body}`);
          resolve([]);
          return;
        }

        content.symbols
          .filter(
            p =>
              ['ETH'].includes(p.quoteAsset) &&
              !['BUSD', 'USDC', 'PAX', 'USDS', 'TUSD', 'USDT'].includes(p.baseAsset) &&
              p.status.toLowerCase() === 'trading'
          )
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'binance'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  /**
   * Init helper for Binance to fetch all USDT pairs with spot only
   * @param callback
   * @param ignoreCrossMargin
   * @returns {Promise<unknown>}
   */
  binanceInitSpotUsdT: async (callback, filterCrossMargin = true) => {
    const crossMarginPairsUsdT = await module.exports.binancecrossMarginPairsUsdT();

    return module.exports.binanceInitUsdT((result, pair) => {
      if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsUsdT.includes(pair.baseAsset)) {
        return undefined;
      }

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * Init helper for Binance to fetch all BUSD pairs with spot only
   * @param callback
   * @param ignoreCrossMargin
   * @returns {Promise<unknown>}
   */
  binanceInitSpotBusd: async (callback, filterCrossMargin = true) => {
    const crossMarginPairsBusd = await module.exports.binancecrossMarginPairsBusd();

    return module.exports.binanceInitBusd((result, pair) => {
      if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsBusd.includes(pair.baseAsset)) {
        return undefined;
      }

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * Init helper for Binance to fetch all BNB pairs with spot only
   * @param callback
   * @param ignoreCrossMargin
   * @returns {Promise<unknown>}
   */
  binanceInitSpotBNB: async (callback, filterCrossMargin = true) => {
    const crossMarginPairsBNB = await module.exports.binancecrossMarginPairsBNB();

    return module.exports.binanceInitBNB((result, pair) => {
      if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsBNB.includes(pair.baseAsset)) {
        return undefined;
      }

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * Init helper for Binance to fetch all BTC pairs with spot only
   * @param callback
   * @param ignoreCrossMargin
   * @returns {Promise<unknown>}
   */
  binanceInitSpotBTC: async (callback, filterCrossMargin = true) => {
    const crossMarginPairsBTC = await module.exports.binancecrossMarginPairsBTC();

    return module.exports.binanceInitBTC((result, pair) => {
      if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsBTC.includes(pair.baseAsset)) {
        return undefined;
      }

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * Init helper for Binance to fetch all ETH pairs with spot only
   * @param callback
   * @param ignoreCrossMargin
   * @returns {Promise<unknown>}
   */
  binanceInitSpotETH: async (callback, filterCrossMargin = true) => {
    const crossMarginPairsETH = await module.exports.binancecrossMarginPairsETH();

    return module.exports.binanceInitETH((result, pair) => {
      if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsETH.includes(pair.baseAsset)) {
        return undefined;
      }

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * There is API (or not documented) where to filter isolated and cross margin wallet pairs take them from fee page api
   *
   * @link https://www.binance.com/de/margin-fee
   * @returns {Promise<unknown>}
   */
  binancecrossMarginPairsUsdT: () => {
    return new Promise(resolve => {
      request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error, _res, body) => {
        const content = JSON.parse(body);
        const crossMarginPairsUsdT = content.data.map(i => i.assetName);

        resolve(crossMarginPairsUsdT);
      });
    });
  },

  /**
   * There is API (or not documented) where to filter isolated and cross margin wallet pairs take them from fee page api
   *
   * @link https://www.binance.com/de/margin-fee
   * @returns {Promise<unknown>}
   */
  binancecrossMarginPairsBusd: () => {
    return new Promise(resolve => {
      request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error, _res, body) => {
        const content = JSON.parse(body);
        const crossMarginPairsBusd = content.data.map(i => i.assetName);

        resolve(crossMarginPairsBusd);
      });
    });
  },

  /**
   * There is API (or not documented) where to filter isolated and cross margin wallet pairs take them from fee page api
   *
   * @link https://www.binance.com/de/margin-fee
   * @returns {Promise<unknown>}
   */
  binancecrossMarginPairsBNB: () => {
    return new Promise(resolve => {
      request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error, _res, body) => {
        const content = JSON.parse(body);
        const crossMarginPairsBNB = content.data.map(i => i.assetName);

        resolve(crossMarginPairsBNB);
      });
    });
  },

  /**
   * There is API (or not documented) where to filter isolated and cross margin wallet pairs take them from fee page api
   *
   * @link https://www.binance.com/de/margin-fee
   * @returns {Promise<unknown>}
   */
  binancecrossMarginPairsBTC: () => {
    return new Promise(resolve => {
      request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error, _res, body) => {
        const content = JSON.parse(body);
        const crossMarginPairsBTC = content.data.map(i => i.assetName);

        resolve(crossMarginPairsBTC);
      });
    });
  },

  /**
   * There is API (or not documented) where to filter isolated and cross margin wallet pairs take them from fee page api
   *
   * @link https://www.binance.com/de/margin-fee
   * @returns {Promise<unknown>}
   */
  binancecrossMarginPairsETH: () => {
    return new Promise(resolve => {
      request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error, _res, body) => {
        const content = JSON.parse(body);
        const crossMarginPairsETH = content.data.map(i => i.assetName);

        resolve(crossMarginPairsETH);
      });
    });
  },

  /**
   * Init helper for Binance to fetch all USDT pairs with margin only
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitMarginUsdT: async callback => {
    const crossMarginPairsUsdT = await module.exports.binancecrossMarginPairsUsdT();

    return module.exports.binanceInitUsdT((result, pair) => {
      if (!pair.isMarginTradingAllowed || !crossMarginPairsUsdT.includes(pair.baseAsset)) {
        return undefined;
      }

      result.exchange = 'binance_margin';

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * Init helper for Binance to fetch all BUSD pairs with margin only
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitMarginBusd: async callback => {
    const crossMarginPairsBusd = await module.exports.binancecrossMarginPairsBusd();

    return module.exports.binanceInitBusd((result, pair) => {
      if (!pair.isMarginTradingAllowed || !crossMarginPairsBusd.includes(pair.baseAsset)) {
        return undefined;
      }

      result.exchange = 'binance_margin';

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * Init helper for Binance to fetch all BTC pairs with margin only
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitMarginBTC: async callback => {
    const crossMarginPairsBTC = await module.exports.binancecrossMarginPairsBTC();

    return module.exports.binanceInitBTC((result, pair) => {
      if (!pair.isMarginTradingAllowed || !crossMarginPairsBTC.includes(pair.baseAsset)) {
        return undefined;
      }

      result.exchange = 'binance_margin';

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * Init helper for Binance to fetch all ETH pairs with margin only
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitMarginETH: async callback => {
    const crossMarginPairsETH = await module.exports.binancecrossMarginPairsETH();

    return module.exports.binanceInitETH((result, pair) => {
      if (!pair.isMarginTradingAllowed || !crossMarginPairsETH.includes(pair.baseAsset)) {
        return undefined;
      }

      result.exchange = 'binance_margin';

      if (!callback) {
        return result;
      }

      return callback(result, pair);
    });
  },

  /**
   * Init helper for Bitmex exchange to fetch only contracts; not this option like pair or weekly / daily pairs
   * @param callback
   * @returns {Promise<unknown>}
   */
  bitmexInit: async callback => {
    return new Promise(resolve => {
      request('https://www.bitmex.com/api/v1/instrument/active', (_error, _res, body) => {
        const pairs = [];

        const content = JSON.parse(body);

        content
          .filter(p => ['FFCCSX', 'FFWCSX'].includes(p.typ))
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'bitmex'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  /**
   * Init helper for Binance futures USDT & BUSD exchange to fetch active contracts
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceFuturesInit: async callback => {
    return new Promise(resolve => {
      request('https://fapi.binance.com/fapi/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        const content = JSON.parse(body);

        content.symbols
          .filter(p => p.status.toUpperCase() === 'TRADING' && p.contractType.toUpperCase() === 'PERPETUAL')
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'binance_futures'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  /**
   * Init helper for Binance futures COIN exchange to fetch active contracts
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceFuturesCoin: async callback => {
    return new Promise(resolve => {
      request('https://dapi.binance.com/dapi/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        const content = JSON.parse(body);

        content.symbols
          .filter(p => p.contractStatus.toUpperCase() === 'TRADING' && p.contractType.toUpperCase() === 'PERPETUAL')
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['15m', '1h'],
              exchange: 'binance_futures_coin'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

 // BitFinex
  bitfinexUsdMarginInit: async callback => {
    return new Promise(resolve => {
      request('https://api.bitfinex.com/v1/symbols_details', (_error, _res, body) => {
        const pairs = [];

        const content = JSON.parse(body);

        content
          .filter(p => p.margin === true && p.pair.endsWith('usd') && !p.pair.startsWith('USD'))
          .forEach(pair => {
            let result = {
              symbol: pair.pair.toUpperCase(),
              periods: ['1m', '15m', '1h'],
              exchange: 'bitfinex'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  //Bybit
  bybitInit: async callback => {
    return new Promise(resolve => {
      request('https://api.bybit.com/v2/public/symbols', (_error, _res, body) => {
        const pairs = [];

        let content;
        try {
          content = JSON.parse(body);
        } catch (e) {
          console.log(`Bybit init issues: ${String(e)} ${body}`);
          resolve([]);
          return;
        }

        if (!content?.result) {
          console.log(`Bybit init issues: ${JSON.stringify(content)}`);
          resolve([]);
          return;
        }

        content.result
          .filter(p => ['USD'].includes(p.quote_currency))
          .forEach(pair => {
            if (pair.name !== pair.alias) {
              console.log(`Bybit: Skip pair init; alias feature not supported: "${pair.name}" - "${pair.alias}"`);
              return;
            }

            let result = {
              symbol: pair.name,
              periods: ['1m', '15m', '1h'],
              exchange: 'bybit'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    });
  },

  bybitLinearInit: async callback =>
    new Promise(resolve => {
      request('https://api.bybit.com/derivatives/v3/public/tickers?category=linear', (_error, _res, body) => {
        const pairs = [];

        let content;
        try {
          content = JSON.parse(body);
        } catch (e) {
          console.log(`Bybit init issues: ${String(e)} ${body}`);
          resolve([]);
          return;
        }

        if (!content?.result?.list) {
          console.log(`Bybit init issues: ${JSON.stringify(content)}`);
          resolve([]);
          return;
        }

        content?.result?.list
          .filter(p => p.symbol && p.symbol.endsWith('USDT'))
          .sort((a, b) => (b.turnover24h || 0) - (a.turnover24h || 0))
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'bybit_linear'
            };

            if (callback) {
              result = callback(result, pair);
            }

            if (result) {
              pairs.push(result);
            }
          });

        resolve(pairs);
      });
    })
};
