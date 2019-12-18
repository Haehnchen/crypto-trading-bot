module.exports = class CandlestickEvent {
  constructor(exchange, symbol, period, candles) {
    this.exchange = exchange;
    this.symbol = symbol;
    this.period = period;
    this.candles = candles;
  }
};
