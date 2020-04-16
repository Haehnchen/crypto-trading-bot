module.exports = class Signal {
  constructor(id, exchange, symbol, side, income_at) {
    this.id = id;
    this.exchange = exchange;
    this.symbol = symbol;
    this.side = side;
    this.income_at = income_at;
  }
};
