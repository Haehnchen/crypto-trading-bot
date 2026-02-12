export interface CandlestickLike {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class ExchangeCandlestick {
  constructor(
    public exchange: string,
    public symbol: string,
    public period: string,
    public time: number,
    public open: number,
    public high: number,
    public low: number,
    public close: number,
    public volume: number
  ) {
    if (!['m', 'h', 'd', 'y'].includes(period.slice(-1))) {
      throw `Invalid candlestick period: ${period} - ${JSON.stringify(Object.values(arguments))}`;
    }

    // simple time validation
    time = parseInt(String(time));
    if (time <= 631148400) {
      throw `Invalid candlestick time given: ${time} - ${JSON.stringify(Object.values(arguments))}`;
    }
  }

  static createFromCandle(exchange: string, symbol: string, period: string, candle: CandlestickLike): ExchangeCandlestick {
    return new ExchangeCandlestick(
      exchange,
      symbol,
      period,
      candle.time,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume
    );
  }
}
