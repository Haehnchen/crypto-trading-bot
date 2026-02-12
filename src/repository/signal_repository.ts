export interface Database {
  prepare(sql: string): Statement;
}

export interface Statement {
  all(parameters?: any): any[];
  run(parameters?: any): void;
}

export class SignalRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async getSignals(since: number): Promise<any[]> {
    const stmt = this.db.prepare('SELECT * from signals where income_at > ? order by income_at DESC LIMIT 100');
    return stmt.all(since);
  }

  insertSignal(exchange: string, symbol: string, options: Record<string, any>, side: string, strategy: string): void {
    const stmt = this.db.prepare(
      'INSERT INTO signals(exchange, symbol, options, side, strategy, income_at) VALUES ($exchange, $symbol, $options, $side, $strategy, $income_at)'
    );

    stmt.run({
      exchange: exchange,
      symbol: symbol,
      options: JSON.stringify(options || {}),
      side: side,
      strategy: strategy,
      income_at: Math.floor(Date.now() / 1000)
    });
  }
}
