import { Ticker } from '../dict/ticker';

export class TickerEvent {
  exchange: string;
  symbol: string;
  ticker: Ticker;

  constructor(exchange: string, symbol: string, ticker: Ticker) {
    this.exchange = exchange;
    this.symbol = symbol;
    this.ticker = ticker;
  }
}
