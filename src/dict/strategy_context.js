module.exports = class StrategyContext {
  constructor(ticker) {
    this.bid = ticker.bid;
    this.ask = ticker.ask;

    this.lastSignal = undefined;
    this.amount = undefined;
    this.entry = undefined;
    this.profit = undefined;
  }

  static createFromPosition(ticker, position) {
    const context = new StrategyContext(ticker);

    context.amount = position.getAmount();
    context.lastSignal = position.getSide();
    context.entry = position.getEntry();
    context.profit = position.getProfit();

    return context;
  }

  getAmount() {
    return this.amount;
  }

  getLastSignal() {
    return this.lastSignal;
  }

  getEntry() {
    return this.entry;
  }

  getProfit() {
    return this.profit;
  }

  static create(ticker) {
    return new StrategyContext(ticker);
  }
};
