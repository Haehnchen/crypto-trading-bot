const { createLogger } = require('../');
const Transport = require('winston-transport');
const util = require('util');

module.exports = class WinstonSqliteTransport extends Transport {
    constructor(opts) {
        super(opts);

        if (!opts['database_connection']) {
            throw 'database_connection is needed'
        }

        if (!opts['table']) {
            throw 'table is needed'
        }

        this.db = opts['database_connection']
        this.table = opts['table']
    }

    log(info, callback) {
        setImmediate(() => {
            this.emit('logged', info);
        })

        let parameters = {
            'uuid': WinstonSqliteTransport.createUUID(),
            'level': info.level,
            'message': info.message,
            'created_at': Math.floor(Date.now() / 1000),
        }

        this.db.prepare('INSERT INTO ' + this.table + '(uuid, level, message, created_at) VALUES ($uuid, $level, $message, $created_at)').run(parameters);

        callback();
    }

    static createUUID() {
        var dt = new Date().getTime();
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = (dt + Math.random()*16)%16 | 0;
            dt = Math.floor(dt/16);
            return (c=='x' ? r :(r&0x3|0x8)).toString(16);
        });
    }
}