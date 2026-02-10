export class Ticker {
  exchange: string;
  symbol: string;
  time: number;
  bid: number;
  ask: number;
  createdAt: Date;

  constructor(exchange: string, symbol: string, time: number, bid: number, ask: number) {
    if (bid <= 0 || ask <= 0 || time <= 0 || !exchange || !symbol) {
      throw new Error(`Invalid Ticker bid/ask/time ${exchange} ${symbol}`);
    }

    this.exchange = exchange;
    this.symbol = symbol;
    this.time = time;
    this.bid = bid;
    this.ask = ask;
    this.createdAt = new Date();
  }
}
