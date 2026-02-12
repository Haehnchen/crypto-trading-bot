import { Ticker } from '../dict/ticker';

export class TickerEvent {
  constructor(
    public exchange: string,
    public symbol: string,
    public ticker: Ticker
  ) {}
}
