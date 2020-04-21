module.exports = class OrderEvent {
  constructor(exchange, order) {
    this.exchange = exchange;
    this.order = order;
  }
};
