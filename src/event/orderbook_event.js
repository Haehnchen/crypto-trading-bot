module.exports = class OrderbookEvent {
  constructor(exchange, symbol, orderbook) {
    this.exchange = exchange;
    this.symbol = symbol;
    this.orderbook = orderbook;
  }
};
