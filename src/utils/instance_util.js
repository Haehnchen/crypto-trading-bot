const request = require('request');

module.exports = {
  /**
   * Init helper for FTX exchange to fetch usd based "perp" contract pairs with a callback to ignore and add trading options
   * @param callback
   * @returns {Promise<unknown>}
   */
  ftxInitPerp: async callback => {
    return new Promise(resolve => {
      request('https://ftx.com/api/markets', (_error, _res, body) => {
        if (_error) {
          resolve([]);
          return;
        }

        const response = JSON.parse(body);
        if (!response.result) {
          resolve([]);
          return;
        }

        const markets = response.result;
        const pairs = [];

        markets
          .filter(m => m.enabled === true && m.type === 'future')
          .filter(m => m.name.endsWith('-PERP')) // name filter
          .forEach(pair => {
            let result = {
              symbol: pair.name,
              periods: ['1m', '15m', '1h'],
              exchange: 'ftx'
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
   * Init helper for Binance to fetch all USDT pairs
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitUsd: async callback => {
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
   * Init helper for Binance to fetch all USDT pairs with spot only
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitSpotUsd: async callback => {
    const crossMarginPairs = await module.exports.binanceCrossMarginPairs();

    return module.exports.binanceInitUsd((result, pair) => {
      if (pair.isMarginTradingAllowed && crossMarginPairs.includes(pair.baseAsset)) {
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
  binanceCrossMarginPairs: () => {
    return new Promise(resolve => {
      request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error, _res, body) => {
        const content = JSON.parse(body);
        const crossMarginPairs = content.data.map(i => i.assetName);

        resolve(crossMarginPairs);
      });
    });
  },

  /**
   * Init helper for Binance to fetch all USDT pairs with margin only
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitMarginUsd: async callback => {
    const crossMarginPairs = await module.exports.binanceCrossMarginPairs();

    return module.exports.binanceInitUsd((result, pair) => {
      if (!pair.isMarginTradingAllowed || !crossMarginPairs.includes(pair.baseAsset)) {
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
   * Init helper for Binance futures exchange to fetch active contracts
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceFuturesInit: async callback => {
    return new Promise(resolve => {
      request('https://fapi.binance.com/fapi/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        const content = JSON.parse(body);

        content.symbols
          .filter(p => p.status.toUpperCase() === 'TRADING')
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

  bybitInit: async callback => {
    return new Promise(resolve => {
      request('https://api.bybit.com/v2/public/symbols', (_error, _res, body) => {
        const pairs = [];

        const content = JSON.parse(body);

        content.result
          .filter(p => ['USD'].includes(p.quote_currency))
          .forEach(pair => {
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
  }
};
