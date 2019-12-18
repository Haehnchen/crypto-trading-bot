const ExchangeCandlestick = require('../../dict/exchange_candlestick');

module.exports = class CandlesFromTrades {
  constructor(candlestickResample, candleImporter) {
    this.candlestickResample = candlestickResample;
    this.candleImporter = candleImporter;

    this.candles = {};
    this.lastCandleMap = {};
  }

  async onTrades(exchangeName, trades, symbols = []) {
    for (const trade of trades) {
      await this.onTrade(exchangeName, trade, symbols);
    }
  }

  /**
   * Exchanges like coinbase does not deliver candles via websocket, so we fake them on the public order history (websocket)
   *
   * @param exchangeName string
   * @param trade array
   * @param symbols array for calculate the resamples
   */
  async onTrade(exchangeName, trade, symbols = []) {
    if (!trade.price || !trade.amount || !trade.symbol || !trade.timestamp) {
      return;
    }

    // Price and volume are sent as strings by the API
    trade.price = parseFloat(trade.price);
    trade.amount = parseFloat(trade.amount);

    const { symbol } = trade;

    // Round the time to the nearest minute, Change as per your resolution
    const roundedTime = Math.floor(new Date(trade.timestamp) / 60000.0) * 60;

    // If the candles hashmap doesnt have this product id create an empty object for that id
    if (!this.candles[symbol]) {
      this.candles[symbol] = {};
    }

    // candle still open just modify it
    if (this.candles[symbol][roundedTime]) {
      // If this timestamp exists in our map for the product id, we need to update an existing candle
      const candle = this.candles[symbol][roundedTime];

      candle.high = trade.price > candle.high ? trade.price : candle.high;
      candle.low = trade.price < candle.low ? trade.price : candle.low;
      candle.close = trade.price;
      candle.volume = parseFloat((candle.volume + trade.amount).toFixed(8));

      // Set the last candle as the one we just updated
      this.lastCandleMap[symbol] = candle;

      return;
    }

    // Before creating a new candle, lets mark the old one as closed
    const lastCandle = this.lastCandleMap[symbol];

    if (lastCandle) {
      lastCandle.closed = true;
      delete this.candles[symbol][lastCandle.timestamp];
    }

    this.candles[symbol][roundedTime] = {
      timestamp: roundedTime,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: trade.amount,
      closed: false
    };

    const ourCandles = [];
    for (const timestamp in this.candles[symbol]) {
      const candle = this.candles[symbol][timestamp];

      ourCandles.push(
        new ExchangeCandlestick(
          exchangeName,
          symbol,
          '1m',
          candle.timestamp,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume
        )
      );
    }

    // delete old candles
    Object.keys(this.candles[symbol])
      .sort((a, b) => b - a)
      .slice(200)
      .forEach(i => {
        delete this.candles[symbol][i];
      });

    await this.candleImporter.insertThrottledCandles(ourCandles);

    let resamples = [];

    const symbolCfg = symbols.find(s => s.symbol === symbol);
    if (symbolCfg) {
      resamples = symbolCfg.periods.filter(r => r !== '1m');
    }

    // wait for insert of previous database inserts
    await Promise.all(
      resamples.map(async resamplePeriod => {
        await this.candlestickResample.resample(exchangeName, symbol, '1m', resamplePeriod, true);
      })
    );
  }
};
