import moment from 'moment';

export interface Database {
  prepare(sql: string): Statement;
}

export interface Statement {
  run(parameters?: any): void;
}

export class TickerLogRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async cleanOldLogEntries(days: number = 14): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM ticker_log WHERE income_at < $income_at');

    stmt.run({
      income_at: moment()
        .subtract(days, 'days')
        .unix()
    });
  }
}
