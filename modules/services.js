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
let CandleStickLogListener = require('../modules/listener/candle_stick_log_listener')
let TickerDatabaseListener = require('../modules/listener/ticker_database_listener')
let TickerLogListener = require('../modules/listener/ticker_log_listener')

let SignalLogger = require('../modules/signal/signal_logger')
let SignalHttp = require('../modules/signal/signal_http')
let SignalListener = require('../modules/signal/signal_listener')

let SignalRepository = require('../modules/repository/signal_repository')
let CandlestickRepository = require('../modules/repository/candlestick_repository')
let StrategyManager = require('./strategy/strategy_manager')

let Bitfinex = require('../exchange/bitfinex')
let Bitmex = require('../exchange/bitmex')
let Binance = require('../exchange/binance')

let Trade = require('../modules/trade')
let Http = require('../modules/http')
let Backtest = require('../modules/backtest')

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
let candleStickLogListener = undefined
let tickerDatabaseListener = undefined
let tickerLogListener = undefined
let tickListener = undefined
let createOrderListener = undefined

let signalLogger = undefined
let signalHttp = undefined
let signalListener = undefined

let signalRepository = undefined
let candlestickRepository = undefined

let exchanges = undefined
let backtest = undefined

var strategyManager = undefined

module.exports = {
    boot: function() {
        instances = require('../instance')
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

    getBacktest: function() {
        if (backtest) {
            return backtest;
        }

        return backtest = new Backtest(
            this.getCandlestickRepository(),
            this.getInstances(),
            this.getStrategyManager(),
        )
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
            return tickListener
        }

        return tickListener = new TickListener(
            this.getTickers(),
            this.getInstances(),
            this.getNotifier(),
            this.getSignalLogger(),
            this.getStrategyManager()
        )
    },

    getCandleStickLogListener: function() {
        if (candleStickLogListener) {
            return candleStickLogListener
        }

        return candleStickLogListener = new CandleStickLogListener(this.getDatabase(), this.getLogger())
    },

    getTickerDatabaseListener: function() {
        if (tickerDatabaseListener) {
            return tickerDatabaseListener
        }

        return tickerDatabaseListener = new TickerDatabaseListener(this.getDatabase(), this.getLogger())
    },

    getTickerLogListener: function() {
        if (tickerLogListener) {
            return tickerLogListener
        }

        return tickerLogListener = new TickerLogListener(this.getDatabase(), this.getLogger())
    },

    getSignalLogger: function() {
        if (signalLogger) {
            return signalLogger
        }

        return signalLogger = new SignalLogger(this.getDatabase(), this.getLogger())
    },

    getSignalHttp: function() {
        if (signalHttp) {
            return signalHttp
        }

        return signalHttp = new SignalHttp(this.getDatabase())
    },

    getSignalListener: function() {
        if (signalListener) {
            return signalListener
        }

        return signalListener = new SignalListener(
            this.getSignalRepository(),
            this.getInstances(),
            this.getTickers(),
            this.getEventEmitter(),
        )
    },

    getSignalRepository: function() {
        if (signalRepository) {
            return signalRepository
        }

        return signalListener = new SignalRepository(
            this.getDatabase(),
        )
    },

    getCandlestickRepository: function() {
        if (candlestickRepository) {
            return candlestickRepository
        }

        return candlestickRepository = new CandlestickRepository(
            this.getDatabase(),
        )
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

    getStrategyManager: function() {
        if (strategyManager) {
            return strategyManager
        }

        return strategyManager = new StrategyManager(this.getCandlestickRepository())
    },

    createWebserverInstance: function() {
        return new Http(
            this.getConfig(),
            this.getTa(),
            this.getSignalHttp(),
            this.getBacktest(),
        )
    },

    getExchangeInstances: function() {
        if (exchanges) {
            return exchanges;
        }

        let eventEmitter = this.getEventEmitter()

        let myExchanges = {}

        let instances = this.getInstances();
        let config = this.getConfig();

        let bitmex = instances.symbols.filter((symbol) => {
            return symbol['exchange'] === 'bitmex' && symbol['state'] === 'watch';
        });

        if(bitmex.length > 0) {
            myExchanges['bitmex'] = new Bitmex(eventEmitter, bitmex, this.getLogger());
        }

        let bitfinex = instances.symbols.filter((symbol) => {
            return symbol['exchange'] === 'bitfinex' && symbol['state'] === 'watch';
        });

        if(bitfinex.length > 0) {
            myExchanges['bitfinex'] = new Bitfinex(eventEmitter, config.exchanges.bitfinex, bitfinex, this.getLogger());
        }

        let binance = instances.symbols.filter((symbol) => {
            return symbol['exchange'] === 'binance' && symbol['state'] === 'watch';
        })


        if(binance.length > 0) {
            myExchanges['binance'] = new Binance(eventEmitter, config.exchanges.binance || {}, binance, this.getLogger());
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
            this.getTickers(),
            this.getCandleStickLogListener(),
            this.getTickerDatabaseListener(),
            this.getTickerLogListener(),
            this.getSignalListener()
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


