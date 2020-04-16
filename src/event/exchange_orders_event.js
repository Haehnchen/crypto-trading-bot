module.exports = class ExchangeOrdersEvent {
  constructor(exchange, orders) {
    this.exchange = exchange;
    this.orders = orders;
  }
};
