import type { Logger } from '../modules/services';

export interface Database {
  prepare(sql: string): Statement;
  transaction(fn: () => void): any;
}

export interface Statement {
  run(parameters?: any): void;
}

export interface Ticker {
  exchange: string;
  symbol: string;
  ask: number;
  bid: number;
  contractType?: string | null;
}

export class TickerRepository {
  private db: Database;
  private logger: Logger;

  constructor(db: Database, logger: Logger) {
    this.db = db;
    this.logger = logger;
  }

  async insertTickers(tickers: Ticker[]): Promise<void> {
    const upsert = this.db.prepare(
      'INSERT INTO ticker(exchange, symbol, ask, bid, updated_at) VALUES ($exchange, $symbol, $ask, $bid, $updated_at) ' +
        'ON CONFLICT(exchange, symbol) DO UPDATE SET ask=$ask, bid=$bid, updated_at=$updated_at'
    );

    this.db.transaction(() => {
      tickers.forEach(ticker => {
        const parameters = {
          exchange: ticker.exchange,
          symbol: ticker.symbol,
          ask: ticker.ask,
          bid: ticker.bid,
          updated_at: new Date().getTime()
        };

        upsert.run(parameters);
      });
    })();
  }
}
