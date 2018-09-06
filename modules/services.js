let sqlite3 = require('sqlite3').verbose();
let TransactionDatabase = require("sqlite3-transactions").TransactionDatabase;
let fs = require('fs');

let db = undefined
let instances = undefined
let config = undefined
let ta = undefined

module.exports = {
    boot: function() {
        this.getDatabase()

        instances = JSON.parse(fs.readFileSync('./instance.json', 'utf8'))
        config = JSON.parse(fs.readFileSync('./conf.json', 'utf8'))
    },

    getDatabase: () => {
        if(db) {
            return db;
        }

        let myDb = new TransactionDatabase(new sqlite3.Database('bot.db'));
        myDb.configure("busyTimeout", 4000)

        return db = myDb
    },

    getTa: function() {
        if(ta) {
            return ta;
        }

        let Ta = require('../modules/ta.js');
        return ta = new Ta(this.getDatabase(), this.getInstances())
    },

    createWebserver: function() {
        let express = require('express')
        let app = express();

        app.set('twig options', {
            allow_async: true,
            strict_variables: false
        });

        app.use(express.static(__dirname + '/../web/static'))

        app.get('/', (req, res) => {
            this.getTa().getTaForPeriods(['15m', '1h']).then((result) => {
                res.render('../templates/base.html.twig', result);
            })
        });

        let port = this.getConfig().webserver.port || 8080;
        console.log('Webserver listening on: ' + port)

        app.listen(port);
    },

    getInstances: () => {
        return instances
    },

    getConfig: () => {
        return config
    }
}


