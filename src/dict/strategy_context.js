module.exports = class StrategyContext {
  constructor(options, ticker, isBacktest) {
    this.bid = ticker.bid;
    this.ask = ticker.ask;

    this.options = options;

    this.lastSignal = undefined;
    this.amount = undefined;
    this.entry = undefined;
    this.profit = undefined;

    this.backtest = isBacktest;
  }

  static createFromPosition(options, ticker, position, isBacktest = false) {
    const context = new StrategyContext(options, ticker, isBacktest);

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

  /**
   * @returns {any}
   */
  getOptions() {
    return this.options;
  }

  /**
   * @returns boolean
   */
  isBacktest() {
    return this.backtest;
  }

  static create(options, ticker, isBacktest) {
    return new StrategyContext(options, ticker, isBacktest);
  }
};
