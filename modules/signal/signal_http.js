'use strict';

module.exports = class SignalHttp {
    constructor(db) {
        this.db = db
    }

    getSignals(since) {
        return new Promise((resolve) => {
            let sql = 'SELECT * from signals where income_at > ? order by income_at DESC LIMIT 100';

            this.db.all(sql, [since], (err, rows) => {
                if(err) {
                    console.log(err)
                }

                resolve(rows.slice())
            })
        })
    }
};