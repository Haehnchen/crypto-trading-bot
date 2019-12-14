module.exports = class ExchangeCandlestick {
  constructor(exchange, symbol, period, time, open, high, low, close, volume) {
    if (!['m', 'h', 'd', 'y'].includes(period.slice(-1))) {
      throw `Invalid candlestick period: ${period} - ${JSON.stringify(Object.values(arguments))}`;
    }

    // simple time validation
    time = parseInt(time);
    if (time <= 631148400) {
      throw `Invalid candlestick time given: ${time} - ${JSON.stringify(Object.values(arguments))}`;
    }

    this.exchange = exchange;
    this.period = period;
    this.symbol = symbol;
    this.time = time;
    this.open = open;
    this.high = high;
    this.low = low;
    this.close = close;
    this.volume = volume;
  }

  static createFromCandle(exchange, symbol, period, candle) {
    return new ExchangeCandlestick(
      exchange,
      symbol,
      period,
      candle.time,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume
    );
  }
};
