const moment = require('moment');

module.exports = class TickerLogRepository {
  constructor(db) {
    this.db = db;
  }

  cleanOldLogEntries(days = 14) {
    return new Promise(resolve => {
      const stmt = this.db.prepare('DELETE FROM ticker_log WHERE income_at < $income_at');

      stmt.run({
        income_at: moment()
          .subtract(days, 'days')
          .unix()
      });

      resolve();
    });
  }
};
