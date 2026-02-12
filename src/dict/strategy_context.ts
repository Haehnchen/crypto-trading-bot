import { Position } from './position';

export class StrategyContext {
  bid: number;
  ask: number;
  lastSignal?: string;
  amount?: number;
  entry?: number;
  profit?: number;

  constructor(
    public options: any,
    ticker: any,
    public backtest: boolean
  ) {
    this.bid = ticker.bid;
    this.ask = ticker.ask;
  }

  static createFromPosition(options: any, ticker: any, position: Position, isBacktest: boolean = false): StrategyContext {
    const context = new StrategyContext(options, ticker, isBacktest);

    context.amount = position.getAmount();
    context.lastSignal = position.getSide();
    context.entry = position.getEntry();
    context.profit = position.getProfit();

    return context;
  }

  getAmount(): number | undefined {
    return this.amount;
  }

  getLastSignal(): string | undefined {
    return this.lastSignal;
  }

  getEntry(): number | undefined {
    return this.entry;
  }

  getProfit(): number | undefined {
    return this.profit;
  }

  getOptions(): any {
    return this.options;
  }

  isBacktest(): boolean {
    return this.backtest;
  }

  static create(options: any, ticker: any, isBacktest: boolean): StrategyContext {
    return new StrategyContext(options, ticker, isBacktest);
  }
}
