import moment from 'moment';

export interface Database {
  prepare(sql: string): Statement;
}

export interface Statement {
  all(parameters?: any): any[];
  run(parameters?: any): void;
}

export class LogsRepository {
  constructor(private db: Database) {}

  async getLatestLogs(excludes: string[] = ['debug'], limit: number = 200): Promise<any[]> {
    let sql = `SELECT * from logs order by created_at DESC LIMIT ${limit}`;

    const parameters: Record<string, any> = {};

    if (excludes.length > 0) {
      sql = `SELECT * from logs WHERE level NOT IN (${excludes
        .map((exclude, index) => `$level_${index}`)
        .join(', ')}) order by created_at DESC LIMIT ${limit}`;

      excludes.forEach((exclude, index) => {
        parameters[`level_${index}`] = exclude;
      });
    }

    const stmt = this.db.prepare(sql);
    return stmt.all(parameters);
  }

  async getLevels(): Promise<string[]> {
    const stmt = this.db.prepare('SELECT level from logs GROUP BY level');
    return stmt.all().map((r: any) => r.level);
  }

  async cleanOldLogEntries(days: number = 7): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM logs WHERE created_at < $created_at');

    stmt.run({
      created_at: moment()
        .subtract(days, 'days')
        .unix()
    });
  }
}
