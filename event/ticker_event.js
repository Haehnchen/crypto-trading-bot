module.exports = class TickerEvent {
  constructor(exchange, symbol, ticker) {
    this.exchange = exchange;
    this.symbol = symbol;
    this.ticker = ticker;
  }
};
