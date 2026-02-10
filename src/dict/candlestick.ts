export class Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;

  constructor(time: number, open: number, high: number, low: number, close: number, volume: number) {
    this.time = time;
    this.open = open;
    this.high = high;
    this.low = low;
    this.close = close;
    this.volume = volume;
  }

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
