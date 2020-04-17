const moment = require('moment');

module.exports = class LogsRepository {
  constructor(db) {
    this.db = db;
  }

  getLatestLogs(excludes = ['debug'], limit = 200) {
    return new Promise(resolve => {
      let sql = `SELECT * from logs order by created_at DESC LIMIT ${limit}`;

      const parameters = {};

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

  getLevels() {
    return new Promise(resolve => {
      const stmt = this.db.prepare('SELECT level from logs GROUP BY level');
      resolve(stmt.all().map(r => r.level));
    });
  }

  cleanOldLogEntries(days = 7) {
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
};
