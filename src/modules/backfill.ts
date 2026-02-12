import moment from 'moment';
import { ExchangeCandlestick } from '../dict/exchange_candlestick';
import { CandleImporter } from './system/candle_importer';

export interface ExchangeInstance {
  getName(): string;
  backfill(symbol: string, period: string, start: Date): Promise<any[]>;
}

export class Backfill {
  constructor(private exchangesIterator: ExchangeInstance[], private candleImporter: CandleImporter) {}

  async backfill(exchangeName: string, symbol: string, period: string, date: number): Promise<void> {
    const exchange = this.exchangesIterator.find((e: ExchangeInstance) => e.getName() === exchangeName);
    if (!exchange) {
      throw new Error(`Exchange not found: ${exchangeName}`);
    }

    let start = moment().subtract(date, 'days').toDate();
    let candles: any[];

    do {
      console.log(`Since: ${start.toISOString()}`);
      candles = await exchange.backfill(symbol, period, start);

      const exchangeCandlesticks = candles.map((candle: any) => {
        return ExchangeCandlestick.createFromCandle(exchangeName, symbol, period, candle);
      });

      await this.candleImporter.insertCandles(exchangeCandlesticks);

      console.log(`Got: ${candles.length} candles`);

      start = new Date(Math.max(...candles.map((r: any) => r.time)) * 1000);
    } while (candles.length > 10);

    console.log('finish');
  }
}
