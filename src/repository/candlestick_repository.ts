import { Candlestick } from '../dict/candlestick';
import { ExchangeCandlestick } from '../dict/exchange_candlestick';

export interface Database {
  prepare(sql: string): Statement;
  transaction(fn: () => void): any;
}

export interface Statement {
  all(parameters?: any): any[];
  run(parameters?: any): void;
}

export interface ExchangeSymbolPair {
  exchange: string;
  symbol: string;
}

export class CandlestickRepository {
  constructor(private db: Database) {}

  async getLookbacksForPair(
    exchange: string,
    symbol: string,
    period: string,
    limit: number = 750,
    olderThen?: number
  ): Promise<Candlestick[]> {
    const olderThenFilter = olderThen ? ' AND time <= :time ' : '';

    const stmt = this.db.prepare(
      `SELECT * from candlesticks WHERE exchange = $exchange AND symbol = $symbol AND period = $period ${olderThenFilter} order by time DESC LIMIT $limit`
    );

    const parameters: any = {
      exchange: exchange,
      symbol: symbol,
      period: period,
      limit: limit
    };

    if (olderThen) {
      parameters.time = olderThen;
    }

    return stmt.all(parameters).map((row: any) => {
      return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume);
    });
  }

  async getLookbacksSince(exchange: string, symbol: string, period: string, start: number): Promise<Candlestick[]> {
    const stmt = this.db.prepare(
      'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? and time > ? order by time DESC'
    );

    return stmt.all([exchange, symbol, period, start]).map((row: any) => {
      return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume);
    });
  }

  async getCandlesInWindow(exchange: string, symbol: string, period: string, start: Date, end: Date): Promise<Candlestick[]> {
    const stmt = this.db.prepare(
      'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? and time > ?  and time < ? order by time DESC LIMIT 1000'
    );

    return stmt
      .all([exchange, symbol, period, Math.round(start.getTime() / 1000), Math.round(end.getTime() / 1000)])
      .map((row: any) => {
        return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume);
      });
  }

  async getExchangePairs(): Promise<ExchangeSymbolPair[]> {
    const stmt = this.db.prepare(
      'select exchange, symbol from candlesticks WHERE period != "1m" AND time > ? group by exchange, symbol order by exchange, symbol'
    );

    // only fetch candles newer the 5 days
    const since = Math.round(new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 2).getTime() / 1000);

    return stmt.all([since]);
  }

  async getCandlePeriods(exchange: string, symbol: string): Promise<string[]> {
    const stmt = this.db.prepare(
      `SELECT period from candlesticks where exchange = ? AND symbol = ? AND time > ? group by period ORDER BY period`
    );

    // only fetch candles newer the 5 days
    const since = Math.round(new Date(new Date().getTime() - 1000 * 60 * 60 * 24 * 5).getTime() / 1000);

    return stmt.all([exchange, symbol, since]).map((row: any) => row.period);
  }

  async insertCandles(exchangeCandlesticks: ExchangeCandlestick[]): Promise<void> {
    const upsert = this.db.prepare(
      'INSERT INTO candlesticks(exchange, symbol, period, time, open, high, low, close, volume) VALUES ($exchange, $symbol, $period, $time, $open, $high, $low, $close, $volume) ' +
        'ON CONFLICT(exchange, symbol, period, time) DO UPDATE SET open=$open, high=$high, low=$low, close=$close, volume=$volume'
    );

    this.db.transaction(() => {
      exchangeCandlesticks.forEach(exchangeCandlestick => {
        const parameters = {
          exchange: exchangeCandlestick.exchange,
          symbol: exchangeCandlestick.symbol,
          period: exchangeCandlestick.period,
          time: exchangeCandlestick.time,
          open: exchangeCandlestick.open,
          high: exchangeCandlestick.high,
          low: exchangeCandlestick.low,
          close: exchangeCandlestick.close,
          volume: exchangeCandlestick.volume
        };

        upsert.run(parameters);
      });
    })();
  }
}
