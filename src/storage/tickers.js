const moment = require('moment');

module.exports = class Tickers {
  constructor() {
    this.tickers = {};
  }

  set(ticker) {
    this.tickers[`${ticker.exchange}.${ticker.symbol}`] = ticker;
  }

  get(exchange, symbol) {
    return this.tickers[`${exchange}.${symbol}`] || null;
  }

  getIfUpToDate(exchange, symbol, lastUpdatedSinceMs) {
    if (!lastUpdatedSinceMs) {
      throw 'Invalid ms argument given';
    }

    if (!`${exchange}.${symbol}` in this.tickers) {
      return undefined;
    }

    return this.tickers[`${exchange}.${symbol}`] &&
      this.tickers[`${exchange}.${symbol}`].createdAt >
        moment()
          .subtract(lastUpdatedSinceMs, 'ms')
          .toDate()
      ? this.tickers[`${exchange}.${symbol}`]
      : undefined;
  }

  all() {
    return this.tickers;
  }
};
