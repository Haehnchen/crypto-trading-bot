let sqlite3 = require('sqlite3').verbose();
let TransactionDatabase = require("sqlite3-transactions").TransactionDatabase;
let fs = require('fs');
let events = require('events')

const { createLogger, transports } = require('winston');

const Notify = require('../notify/notify');
let Slack = require('../notify/slack');
let Mail = require('../notify/mail');

let Tickers = require('../storage/tickers');

let CandleStickListener = require('../modules/listener/candle_stick_listener')
let TickListener = require('../modules/listener/tick_listener')
let CreateOrderListener = require('../modules/listener/create_order_listener')

let Bitfinex = require('../exchange/bitfinex')
let Bitmex = require('../exchange/bitmex')

let Trade = require('../modules/trade')
let Http = require('../modules/http')

var _ = require('lodash');

let db = undefined
let instances = undefined
let config = undefined
let ta = undefined
let eventEmitter = undefined
let logger = undefined
let notify = undefined
let tickers = undefined

let candleStickListener = undefined
let tickListener = undefined
let createOrderListener = undefined

let exchanges = undefined

module.exports = {
    boot: function() {
        instances = JSON.parse(fs.readFileSync('./instance.json', 'utf8'))
        config = JSON.parse(fs.readFileSync('./conf.json', 'utf8'))

        this.getDatabase()
        this.getExchangeInstances()
    },

    getDatabase: () => {
        if (db) {
            return db;
        }

        let myDb = new TransactionDatabase(new sqlite3.Database('bot.db'));
        myDb.configure("busyTimeout", 4000)

        return db = myDb
    },

    getTa: function() {
        if (ta) {
            return ta;
        }

        let Ta = require('../modules/ta.js');
        return ta = new Ta(this.getDatabase(), this.getInstances())
    },

    getCandleStickListener: function() {
        if (candleStickListener) {
            return candleStickListener;
        }

        return candleStickListener = new CandleStickListener(this.getDatabase())
    },

    getCreateOrderListener: function() {
        if (createOrderListener) {
            return createOrderListener;
        }

        return createOrderListener = new CreateOrderListener(this.getExchangeInstances(), this.getLogger())
    },

    getTickListener: function() {
        if (tickListener) {
            return tickListener;
        }

        return tickListener = new TickListener(this.getDatabase(), this.getTickers(), this.getInstances())
    },

    getEventEmitter: function() {
        if (eventEmitter) {
            return eventEmitter;
        }

        return eventEmitter = new events.EventEmitter()
    },

    getLogger: function() {
        if (logger) {
            return logger;
        }

        return logger = createLogger({
            level: 'debug',
            transports: [
                new transports.File({filename: './var/log/log.log', timestamp: true}),
                //new transports.Console()
            ]
        });
    },

    getNotifier: function() {
        let notifiers = []

        let config = this.getConfig();

        if (_.has(config, 'notify.slack')) {
            notifiers.push(new Slack(config.notify.slack))
        }

        if (_.has(config, 'notify.mail.username')) {
            notifiers.push(new Mail(this.createMailer(), this.getLogger()))
        }

        return notify = new Notify(notifiers)
    },

    getTickers: function() {
        if (tickers) {
            return tickers;
        }

        return tickers = new Tickers()
    },

    createWebserverInstance: function() {
        return new Http(this.getConfig(), this.getTa())
    },

    getExchangeInstances: function() {
        if (exchanges) {
            return exchanges;
        }

        let eventEmitter = this.getEventEmitter()

        let myExchanges = {}

        let instances = this.getInstances();
        let config = this.getConfig();

        let filter = instances.symbols.filter(function (symbol) {
            return symbol['exchange'] === 'bitmex' && symbol['state'] === 'watch';
        });

        if(filter.length > 0) {
            myExchanges['bitmex'] = new Bitmex(eventEmitter, filter, this.getLogger());
        }

        let filter2 = instances.symbols.filter(function (symbol) {
            return symbol['exchange'] === 'bitfinex' && symbol['state'] === 'watch';
        });

        if(filter2.length > 0) {
            myExchanges['bitfinex'] = new Bitfinex(eventEmitter, config.exchanges.bitfinex, filter2, this.getLogger());
        }

        return exchanges = myExchanges
    },

    createTradeInstance: function() {
        return new Trade(
            this.getEventEmitter(),
            this.getInstances(),
            this.getNotifier(),
            this.getLogger(),
            this.getCreateOrderListener(),
            this.getTickListener(),
            this.getCandleStickListener(),
            this.getTickers()
        )
    },

    createMailer: function() {
        var mail = require("nodemailer")

        let config = this.getConfig()

        return mail.createTransport(
            'smtps://' + config.notify.mail.username +':' + config.notify.mail.password + '@' + config.notify.mail.server + ':' + (config.notify.mail.password || 465), {
                from: config.notify.mail.username
            });
    },

    getInstances: () => {
        return instances
    },

    getConfig: () => {
        return config
    }
}


