import { ExchangeCandlestick } from '../dict/exchange_candlestick';

export class CandlestickEvent {
  exchange: string;
  symbol: string;
  period: string;
  candles: ExchangeCandlestick[];

  constructor(exchange: string, symbol: string, period: string, candles: ExchangeCandlestick[]) {
    this.exchange = exchange;
    this.symbol = symbol;
    this.period = period;
    this.candles = candles;
  }
}
