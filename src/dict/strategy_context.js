module.exports = class StrategyContext {
  constructor(ticker) {
    this.bid = ticker.bid;
    this.ask = ticker.ask;

    this.lastSignal = undefined;
    this.amount = undefined;
    this.entry = undefined;
  }

  static createFromPosition(ticker, position) {
    const context = new StrategyContext(ticker);

    context.amount = position.amount;
    context.lastSignal = position.amount < 0 ? 'short' : 'long';
    context.entry = position.entry;

    return context;
  }

  static create(ticker) {
    return new StrategyContext(ticker);
  }
};
