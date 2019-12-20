const request = require('request');

module.exports = {
  /**
   * Init helper for FTX exchange to fetch usd based "perp" contract pairs with a callback to ignore and add trading options
   * @param callback
   * @returns {Promise<unknown>}
   */
  ftxInitPerp: async function(callback) {
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
              exchange: 'ftx',
              state: 'watch'
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
   * Init helper for FTX exchange to fetch usd based "perp" contract pairs with a callback to ignore and add trading options
   * @param callback
   * @returns {Promise<unknown>}
   */
  binanceInitUsd: async function(callback) {
    return new Promise(resolve => {
      request('https://api.binance.com/api/v1/exchangeInfo', (_error, _res, body) => {
        const pairs = [];

        const content = JSON.parse(body);

        if (!content.symbols) {
          resolve([]);
          return;
        }

        content.symbols
          .filter(
            p =>
              p.quoteAsset === 'USDT' &&
              !['USDC', 'PAX', 'USDS', 'TUSD'].includes(p.baseAsset) &&
              p.status.toLowerCase() === 'trading'
          )
          .forEach(pair => {
            let result = {
              symbol: pair.symbol,
              periods: ['1m', '15m', '1h'],
              exchange: 'binance',
              state: 'watch'
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
