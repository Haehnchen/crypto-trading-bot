export class Candlestick {
  constructor(
    public time: number,
    public open: number,
    public high: number,
    public low: number,
    public close: number,
    public volume: number
  ) {}

  getArray(): { time: number; open: number; high: number; low: number; close: number; volume: number } {
    return {
      time: this.time,
      open: this.open,
      high: this.high,
      low: this.low,
      close: this.close,
      volume: this.volume
    };
  }
}
