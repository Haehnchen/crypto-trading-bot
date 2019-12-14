let fs = require('fs');
let events = require('events');

const { createLogger, transports, format } = require('winston');

const Notify = require('../notify/notify');
let Slack = require('../notify/slack');
let Mail = require('../notify/mail');
let Telegram = require('../notify/telegram');

let Tickers = require('../storage/tickers');

let TickListener = require('../modules/listener/tick_listener');
let CreateOrderListener = require('../modules/listener/create_order_listener');
let TickerDatabaseListener = require('../modules/listener/ticker_database_listener');
let ExchangeOrderWatchdogListener = require('../modules/listener/exchange_order_watchdog_listener');
let ExchangePositionWatcher = require('../modules/exchange/exchange_position_watcher');

let SignalLogger = require('../modules/signal/signal_logger');
let SignalHttp = require('../modules/signal/signal_http');

let SignalRepository = require('../modules/repository/signal_repository');
let CandlestickRepository = require('../modules/repository/candlestick_repository');
let StrategyManager = require('./strategy/strategy_manager');
let ExchangeManager = require('./exchange/exchange_manager');

let Trade = require('../modules/trade');
let Http = require('../modules/http');
let Backtest = require('../modules/backtest');
let Backfill = require('../modules/backfill');

let StopLossCalculator = require('../modules/order/stop_loss_calculator');
let RiskRewardRatioCalculator = require('../modules/order/risk_reward_ratio_calculator');
let PairsHttp = require('../modules/pairs/pairs_http');
let OrderExecutor = require('../modules/order/order_executor');
let OrderCalculator = require('../modules/order/order_calculator');
let PairStateManager = require('../modules/pairs/pair_state_manager');
let PairStateExecution = require('../modules/pairs/pair_state_execution');
let SystemUtil = require('../modules/system/system_util');
let TechnicalAnalysisValidator = require('../utils/technical_analysis_validator');
let WinstonSqliteTransport = require('../utils/winston_sqlite_transport');
let LogsHttp = require('./system/logs_http');
let LogsRepository = require('../modules/repository/logs_repository');
let TickerLogRepository = require('../modules/repository/ticker_log_repository');
let TickerRepository = require('../modules/repository/ticker_repository');
let CandlestickResample = require('../modules/system/candlestick_resample');
let RequestClient = require('../utils/request_client');
let Queue = require('../utils/queue');

let Bitmex = require('../exchange/bitmex');
let BitmexTestnet = require('../exchange/bitmex_testnet');
let Binance = require('../exchange/binance');
let Bitfinex = require('../exchange/bitfinex');
let CoinbasePro = require('../exchange/coinbase_pro');
let Noop = require('../exchange/noop');
let Bybit = require('../exchange/bybit');
let FTX = require('../exchange/ftx');

let ExchangeCandleCombine = require('../modules/exchange/exchange_candle_combine');
let CandleExportHttp = require('../modules/system/candle_export_http');
let CandleImporter = require('../modules/system/candle_importer');

let _ = require('lodash');

let db = undefined;
let instances = undefined;
let config = undefined;
let ta = undefined;
let eventEmitter = undefined;
let logger = undefined;
let notify = undefined;
let tickers = undefined;
let queue = undefined;

let candleStickImporter = undefined;
let tickerDatabaseListener = undefined;
let tickListener = undefined;
let createOrderListener = undefined;
let exchangeOrderWatchdogListener = undefined;

let signalLogger = undefined;
let signalHttp = undefined;

let signalRepository = undefined;
let candlestickRepository = undefined;

let exchangeManager = undefined;
let backtest = undefined;
let pairStateManager = undefined;
let pairStateExecution = undefined;

let strategyManager = undefined;

let stopLossCalculator = undefined;
let riskRewardRatioCalculator = undefined;
let pairsHttp = undefined;
let orderExecutor = undefined;
let orderCalculator = undefined;
let systemUtil = undefined;
let technicalAnalysisValidator = undefined;
let logsHttp = undefined;
let logsRepository = undefined;
let tickerLogRepository = undefined;
let candlestickResample = undefined;
let exchanges = undefined;
let requestClient = undefined;
let exchangeCandleCombine = undefined;
let candleExportHttp = undefined;
let exchangePositionWatcher = undefined;
let tickerRepository = undefined;

module.exports = {
    boot: async function () {
        try {
            instances = require('../instance')
        } catch (e) {
            throw 'Invalid instance.js file. Please check' + String(e);
            process.exit();
            return
        }

        // boot instance eg to load pairs external
        if (typeof instances.init === 'function') {
            await instances.init()
        }

        try {
            config = JSON.parse(fs.readFileSync('./conf.json', 'utf8'))
        } catch (e) {
            throw 'Invalid conf.json file. Please check: ' + String(e);
            process.exit();
            return
        }

        this.getDatabase()
    },

    getDatabase: () => {
        if (db) {
            return db;
        }

        let myDb = require('better-sqlite3')('bot.db');
        myDb.pragma('journal_mode = WAL');

        myDb.pragma('SYNCHRONOUS = 1;');
        myDb.pragma('LOCKING_MODE = EXCLUSIVE;');

        return db = myDb
    },

    getTa: function () {
        if (ta) {
            return ta;
        }

        let Ta = require('../modules/ta.js');
        return ta = new Ta(this.getCandlestickRepository(), this.getInstances(), this.getTickers())
    },

    getBacktest: function () {
        if (backtest) {
            return backtest;
        }

        return backtest = new Backtest(
            this.getInstances(),
            this.getStrategyManager(),
            this.getExchangeCandleCombine(),
        )
    },

    getStopLossCalculator: function () {
        if (stopLossCalculator) {
            return stopLossCalculator
        }

        return stopLossCalculator = new StopLossCalculator(this.getTickers(), this.getLogger())
    },

    getRiskRewardRatioCalculator: function () {
        if (riskRewardRatioCalculator) {
            return riskRewardRatioCalculator
        }

        return riskRewardRatioCalculator = new RiskRewardRatioCalculator(this.getLogger())
    },

    getCandleImporter: function () {
        if (candleStickImporter) {
            return candleStickImporter;
        }

        return candleStickImporter = new CandleImporter(
            this.getCandlestickRepository(),
        )
    },

    getCreateOrderListener: function () {
        if (createOrderListener) {
            return createOrderListener;
        }

        return createOrderListener = new CreateOrderListener(this.getExchangeManager(), this.getLogger())
    },

    getTickListener: function () {
        if (tickListener) {
            return tickListener
        }

        return tickListener = new TickListener(
            this.getTickers(),
            this.getInstances(),
            this.getNotifier(),
            this.getSignalLogger(),
            this.getStrategyManager(),
            this.getExchangeManager(),
            this.getPairStateManager(),
            this.getLogger(),
            this.getSystemUtil(),
        )
    },

    getExchangeOrderWatchdogListener: function () {
        if (exchangeOrderWatchdogListener) {
            return exchangeOrderWatchdogListener
        }

        return exchangeOrderWatchdogListener = new ExchangeOrderWatchdogListener(
            this.getExchangeManager(),
            this.getInstances(),
            this.getStopLossCalculator(),
            this.getRiskRewardRatioCalculator(),
            this.getOrderExecutor(),
            this.getPairStateManager(),
            this.getLogger(),
            this.getTickers(),
        )
    },

    getTickerDatabaseListener: function () {
        if (tickerDatabaseListener) {
            return tickerDatabaseListener
        }

        return tickerDatabaseListener = new TickerDatabaseListener(this.getTickerRepository())
    },

    getSignalLogger: function () {
        if (signalLogger) {
            return signalLogger
        }

        return signalLogger = new SignalLogger(this.getSignalRepository())
    },

    getSignalHttp: function () {
        if (signalHttp) {
            return signalHttp
        }

        return signalHttp = new SignalHttp(this.getSignalRepository())
    },

    getSignalRepository: function () {
        if (signalRepository) {
            return signalRepository
        }

        return signalRepository = new SignalRepository(
            this.getDatabase(),
        )
    },

    getCandlestickRepository: function () {
        if (candlestickRepository) {
            return candlestickRepository
        }

        return candlestickRepository = new CandlestickRepository(
            this.getDatabase(),
        )
    },

    getEventEmitter: function () {
        if (eventEmitter) {
            return eventEmitter;
        }

        return eventEmitter = new events.EventEmitter();
    },

    getLogger: function () {
        if (logger) {
            return logger;
        }

        return logger = createLogger({
            format: format.combine(
                format.timestamp(),
                format.json()
            ),
            transports: [
                new transports.File({
                    filename: './var/log/log.log',
                    level: 'debug',
                }),
                new transports.Console({
                    level: 'error',
                }),
                new WinstonSqliteTransport({
                    level: 'debug',
                    database_connection: this.getDatabase(),
                    table: 'logs',
                })
            ]
        });
    },

    getNotifier: function () {
        let notifiers = [];

        let config = this.getConfig();

        let slack = _.get(config, 'notify.slack');
        if (slack && slack.webhook && slack.webhook.length > 0) {
            notifiers.push(new Slack(slack))
        }

        let mailServer = _.get(config, 'notify.mail.server');
        if (mailServer && mailServer.length > 0) {
            notifiers.push(new Mail(
                this.createMailer(),
                this.getSystemUtil(),
                this.getLogger(),
            ))
        }

        let telegram = _.get(config, 'notify.telegram');
        if (telegram && telegram.chat_id && telegram.chat_id.length > 0 && telegram.token && telegram.token.length > 0) {
            notifiers.push(new Telegram(
                this.createTelegram(),
                telegram,
                this.getLogger(),
            ))
        }

        return notify = new Notify(notifiers)
    },

    getTickers: function () {
        if (tickers) {
            return tickers;
        }

        return tickers = new Tickers()
    },

    getStrategyManager: function () {
        if (strategyManager) {
            return strategyManager
        }

        return strategyManager = new StrategyManager(
            this.getTechnicalAnalysisValidator(),
            this.getExchangeCandleCombine(),
            this.getLogger(),
        )
    },

    createWebserverInstance: function () {
        return new Http(
            this.getSystemUtil(),
            this.getTa(),
            this.getSignalHttp(),
            this.getBacktest(),
            this.getExchangeManager(),
            this.getHttpPairs(),
            this.getLogsHttp(),
            this.getCandleExportHttp(),
            this.getCandleImporter(),
        )
    },

    getExchangeManager: function () {
        if (exchangeManager) {
            return exchangeManager;
        }

        return exchangeManager = new ExchangeManager(
            this.getExchanges(),
            this.getLogger(),
            this.getInstances(),
            this.getConfig(),
        )
    },

    getOrderExecutor: function () {
        if (orderExecutor) {
            return orderExecutor;
        }

        return orderExecutor = new OrderExecutor(
            this.getExchangeManager(),
            this.getTickers(),
            this.getSystemUtil(),
            this.getLogger(),
            this.getPairStateManager(),
        )
    },

    getOrderCalculator: function () {
        if (orderCalculator) {
            return orderCalculator;
        }

        return orderCalculator = new OrderCalculator(
            this.getInstances(),
            this.getTickers(),
            this.getLogger(),
            this.getExchangeManager(),
        )
    },

    getHttpPairs: function () {
        if (pairsHttp) {
            return pairsHttp;
        }

        return pairsHttp = new PairsHttp(
            this.getInstances(),
            this.getExchangeManager(),
            this.getPairStateManager(),
            this.getEventEmitter(),
        )
    },

    getPairStateManager: function () {
        if (pairStateManager) {
            return pairStateManager;
        }

        return pairStateManager = new PairStateManager(
            this.getLogger(),
        )
    },

    getPairStateExecution: function () {
        if (pairStateExecution) {
            return pairStateExecution
        }

        return pairStateExecution = new PairStateExecution(
            this.getPairStateManager(),
            this.getExchangeManager(),
            this.getOrderCalculator(),
            this.getOrderExecutor(),
            this.getLogger(),
        )
    },

    getSystemUtil: function () {
        if (systemUtil) {
            return systemUtil;
        }

        return systemUtil = new SystemUtil(
            this.getConfig(),
        )
    },

    getTechnicalAnalysisValidator: function () {
        if (technicalAnalysisValidator) {
            return technicalAnalysisValidator;
        }

        return technicalAnalysisValidator = new TechnicalAnalysisValidator()
    },

    getLogsRepository: function () {
        if (logsRepository) {
            return logsRepository;
        }

        return logsRepository = new LogsRepository(this.getDatabase())
    },

    getLogsHttp: function () {
        if (logsHttp) {
            return logsHttp;
        }

        return logsHttp = new LogsHttp(this.getLogsRepository())
    },

    getTickerLogRepository: function () {
        if (tickerLogRepository) {
            return tickerLogRepository;
        }

        return tickerLogRepository = new TickerLogRepository(this.getDatabase())
    },

    getTickerRepository: function () {
        if (tickerRepository) {
            return tickerRepository;
        }

        return tickerRepository = new TickerRepository(this.getDatabase(), this.getLogger())
    },

    getCandlestickResample: function () {
        if (candlestickResample) {
            return candlestickResample;
        }

        return candlestickResample = new CandlestickResample(
            this.getCandlestickRepository(),
            this.getCandleImporter(),
        )
    },

    getRequestClient: function () {
        if (requestClient) {
            return requestClient;
        }

        return requestClient = new RequestClient(
            this.getLogger(),
        )
    },

    getQueue: function () {
        if (queue) {
            return queue;
        }

        return queue = new Queue()
    },

    getCandleExportHttp: function () {
        if (candleExportHttp) {
            return candleExportHttp;
        }

        return candleExportHttp = new CandleExportHttp(
            this.getCandlestickRepository(),
        )
    },

    getExchangeCandleCombine: function () {
        if (exchangeCandleCombine) {
            return exchangeCandleCombine
        }

        return exchangeCandleCombine = new ExchangeCandleCombine(
            this.getCandlestickRepository(),
        )
    },

    getExchangePositionWatcher: function () {
        if (exchangePositionWatcher) {
            return exchangePositionWatcher
        }

        return exchangePositionWatcher = new ExchangePositionWatcher(
            this.getExchangeManager(),
            this.getEventEmitter(),
            this.getLogger(),
        )
    },

    getExchanges: function () {
        if (exchanges) {
            return exchanges;
        }

        return exchanges = [
            new Bitmex(
                this.getEventEmitter(),
                this.getRequestClient(),
                this.getCandlestickResample(),
                this.getLogger(),
                this.getQueue(),
                this.getCandleImporter(),
            ),
            new BitmexTestnet(
                this.getEventEmitter(),
                this.getRequestClient(),
                this.getCandlestickResample(),
                this.getLogger(),
                this.getQueue(),
                this.getCandleImporter(),
            ),
            new Binance(
                this.getEventEmitter(),
                this.getLogger(),
                this.getQueue(),
                this.getCandleImporter(),
            ),
            new CoinbasePro(
                this.getEventEmitter(),
                this.getLogger(),
                this.getCandlestickResample(),
                this.getQueue(),
                this.getCandleImporter(),
            ),
            new Bitfinex(
                this.getEventEmitter(),
                this.getLogger(),
                this.getRequestClient(),
                this.getCandleImporter(),
            ),
            new Bybit(
                this.getEventEmitter(),
                this.getRequestClient(),
                this.getCandlestickResample(),
                this.getLogger(),
                this.getQueue(),
                this.getCandleImporter(),
            ),
            new FTX(
                this.getEventEmitter(),
                this.getRequestClient(),
                this.getCandlestickResample(),
                this.getLogger(),
                this.getQueue(),
                this.getCandleImporter(),
            ),
            new Noop(),
        ]
    },

    createTradeInstance: function () {
        this.getExchangeManager().init();

        return new Trade(
            this.getEventEmitter(),
            this.getInstances(),
            this.getNotifier(),
            this.getLogger(),
            this.getCreateOrderListener(),
            this.getTickListener(),
            this.getTickers(),
            this.getTickerDatabaseListener(),
            this.getExchangeOrderWatchdogListener(),
            this.getOrderExecutor(),
            this.getPairStateExecution(),
            this.getSystemUtil(),
            this.getLogsRepository(),
            this.getTickerLogRepository(),
            this.getExchangePositionWatcher(),
        )
    },

    getBackfill: function () {
        return new Backfill(
            this.getExchanges(),
            this.getCandleImporter(),
        )
    },

    createMailer: function () {
        var mail = require("nodemailer");

        let config = this.getConfig();

        return mail.createTransport(
            'smtps://' + config.notify.mail.username + ':' + config.notify.mail.password + '@' + config.notify.mail.server + ':' + (config.notify.mail.password || 465), {
                from: config.notify.mail.username
            });
    },

    createTelegram: function () {
        const Telegraf = require('telegraf');
        const config = this.getConfig();
        const token = config.notify.telegram.token;

        if (!token) {
            console.log('Telegram: No api token given');
            return
        }

        return new Telegraf(token)
    },

    getInstances: () => {
        return instances
    },

    getConfig: () => {
        return config
    }
};
