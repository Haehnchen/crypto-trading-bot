'use strict';

let moment = require('moment')

module.exports = class LogsRepository {
    constructor(db) {
        this.db = db
    }

    getLatestLogs(limit = 200) {
        return new Promise((resolve) => {
            let sql = 'SELECT * from logs order by created_at DESC LIMIT ' + limit

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    console.log(err)
                    resolve()
                    return
                }

                if(rows.length === 0) {
                    resolve([])
                }

                resolve(rows)
            });
        })
    }

    cleanOldLogEntries(days = 7) {
        return new Promise((resolve) => {
            this.db.run('DELETE FROM logs WHERE created_at < $created_at', {'$created_at': moment().subtract(days, 'days').unix()}, function(err) {
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
