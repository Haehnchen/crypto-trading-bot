const moment = require('moment');
const _ = require('lodash');
const ExchangeCandlestick = require('../dict/exchange_candlestick');

module.exports = class Backfill {
  constructor(exchangesIterator, candleImporter) {
    this.exchangesIterator = exchangesIterator;
    this.candleImporter = candleImporter;
  }

  async backfill(exchangeName, symbol, period, date) {
    const exchange = this.exchangesIterator.find(e => e.getName() === exchangeName);
    if (!exchange) {
      throw `Exchange not found: ${exchangeName}`;
    }

    let start = moment().subtract(date, 'days');
    let candles;

    do {
      console.log(`Since: ${new Date(start).toISOString()}`);
      candles = await exchange.backfill(symbol, period, start);

      const exchangeCandlesticks = candles.map(candle => {
        return ExchangeCandlestick.createFromCandle(exchangeName, symbol, period, candle);
      });

      await this.candleImporter.insertCandles(exchangeCandlesticks);

      console.log(`Got: ${candles.length} candles`);

      start = new Date(_.max(candles.map(r => r.time)) * 1000);
    } while (candles.length > 10);

    console.log('finish');
  }
};
