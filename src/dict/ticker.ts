export class Ticker {
  createdAt: Date;

  constructor(
    public exchange: string,
    public symbol: string,
    public time: number,
    public bid: number,
    public ask: number
  ) {
    if (bid <= 0 || ask <= 0 || time <= 0 || !exchange || !symbol) {
      throw new Error(`Invalid Ticker bid/ask/time ${exchange} ${symbol}`);
    }

    this.createdAt = new Date();
  }
}
