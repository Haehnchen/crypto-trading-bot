import moment from 'moment';

export interface Database {
  prepare(sql: string): Statement;
}

export interface Statement {
  all(parameters?: any): any[];
  run(parameters?: any): void;
}

export class LogsRepository {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  getLatestLogs(excludes: string[] = ['debug'], limit: number = 200): Promise<any[]> {
    return new Promise(resolve => {
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
      resolve(stmt.all(parameters));
    });
  }

  getLevels(): Promise<string[]> {
    return new Promise(resolve => {
      const stmt = this.db.prepare('SELECT level from logs GROUP BY level');
      resolve(stmt.all().map((r: any) => r.level));
    });
  }

  cleanOldLogEntries(days: number = 7): Promise<void> {
    return new Promise(resolve => {
      const stmt = this.db.prepare('DELETE FROM logs WHERE created_at < $created_at');

      stmt.run({
        created_at: moment()
          .subtract(days, 'days')
          .unix()
      });

      resolve();
    });
  }
}
