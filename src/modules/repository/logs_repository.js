const moment = require('moment');

module.exports = class LogsRepository {
  constructor(db) {
    this.db = db;
  }

  getLatestLogs(filters = { logExcludeLevels: ['debug'], logTxtFilter: '' }, limit = 200) {
    return new Promise(resolve => {
      const parameters = {};
      let sql = `SELECT * from logs WHERE 1=1`;

      if (filters.logExcludeLevels.length > 0) {
        sql += ` AND level NOT IN (${filters.logExcludeLevels
          .map((_exclude, index) => `$level_${index}`)
          .join(', ')}) `;

        filters.logExcludeLevels.forEach((exclude, index) => {
          parameters[`level_${index}`] = exclude;
        });
      }

      if (filters.logTxtFilter !== '') {
        sql += ` AND message LIKE '%${filters.logTxtFilter}%'`;
      }

      sql += ` order by created_at DESC LIMIT ${limit}`;

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
