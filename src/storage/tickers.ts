import moment from 'moment';
import { Ticker } from '../dict/ticker';

export class Tickers {
  private tickers: Record<string, Ticker>;

  constructor() {
    this.tickers = {};
  }

  set(ticker: Ticker): void {
    this.tickers[`${ticker.exchange}.${ticker.symbol}`] = ticker;
  }

  get(exchange: string, symbol: string): Ticker | null {
    return this.tickers[`${exchange}.${symbol}`] || null;
  }

  getIfUpToDate(exchange: string, symbol: string, lastUpdatedSinceMs: number): Ticker | undefined {
    if (!lastUpdatedSinceMs) {
      throw 'Invalid ms argument given';
    }

    const key = `${exchange}.${symbol}`;
    if (!(key in this.tickers)) {
      return undefined;
    }

    const ticker = this.tickers[key];
    return ticker &&
      ticker.createdAt >
        moment()
          .subtract(lastUpdatedSinceMs, 'ms')
          .toDate()
      ? ticker
      : undefined;
  }

  all(): Record<string, Ticker> {
    return this.tickers;
  }
}
