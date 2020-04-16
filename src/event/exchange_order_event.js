module.exports = class ExchangeOrderEvent {
  constructor(exchange, order) {
    this.exchange = exchange;
    this.order = order;
  }
};
