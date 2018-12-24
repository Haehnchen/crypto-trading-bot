'use strict';

let moment = require('moment')

module.exports = class LogsRepository {
    constructor(db) {
        this.db = db
    }

    getLatestLogs(excludes = ['debug'], limit = 200) {
        return new Promise((resolve) => {
            let sql = 'SELECT * from logs order by created_at DESC LIMIT ' + limit

            let parameters = {}

            if (excludes.length > 0) {
                sql = 'SELECT * from logs WHERE level NOT IN (' + excludes.map((exclude, index) => '$level_' + index).join(', ') + ') order by created_at DESC LIMIT ' + limit

                excludes.forEach((exclude, index) => { parameters['$level_' + index] = exclude })
            }

            this.db.all(sql, parameters, (err, rows) => {
                if (err) {
                    console.log(err)
                    resolve()
                    return
                }

                if(rows.length === 0) {
                    resolve([])
                    return
                }

                resolve(rows)
            });
        })
    }

    getLevels() {
        return new Promise((resolve) => {
            this.db.all('SELECT level from logs GROUP BY level', [], (err, rows) => {
                if (err) {
                    console.log(err)
                    resolve()
                    return
                }

                if(rows.length === 0) {
                    resolve([])
                    return
                }

                resolve(rows.map(r => r.level))
            })
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
