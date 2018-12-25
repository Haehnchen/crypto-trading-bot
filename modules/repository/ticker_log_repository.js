'use strict';

let moment = require('moment')

module.exports = class TickerLogRepository {
    constructor(db) {
        this.db = db
    }

    cleanOldLogEntries(days = 14) {
        return new Promise((resolve) => {
            this.db.run('DELETE FROM ticker_log WHERE income_at < $income_at', {'$income_at': moment().subtract(days, 'days').unix()}, function(err) {
                if (err) {
                    resolve()
                    console.error(err)
                    return
                }

                resolve()
            });
        })
    }
}
