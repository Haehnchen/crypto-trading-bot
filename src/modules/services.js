const fs = require('fs');
const events = require('events');

const { createLogger, transports, format } = require('winston');

const _ = require('lodash');
const Sqlite = require('better-sqlite3');
const Notify = require('../notify/notify');
const Slack = require('../notify/slack');
const Mail = require('../notify/mail');
const Telegram = require('../notify/telegram');

const Tickers = require('../storage/tickers');
const Ta = require('../modules/ta.js');

const TickListener = require('../modules/listener/tick_listener');
const CreateOrderListener = require('../modules/listener/create_order_listener');
const TickerDatabaseListener = require('../modules/listener/ticker_database_listener');
const ExchangeOrderWatchdogListener = require('../modules/listener/exchange_order_watchdog_listener');
const ExchangePositionWatcher = require('../modules/exchange/exchange_position_watcher');

const SignalLogger = require('../modules/signal/signal_logger');
const SignalHttp = require('../modules/signal/signal_http');

const SignalRepository = require('../modules/repository/signal_repository');
const CandlestickRepository = require('../modules/repository/candlestick_repository');
const StrategyManager = require('./strategy/strategy_manager');
const ExchangeManager = require('./exchange/exchange_manager');

const Trade = require('../modules/trade');
const Http = require('../modules/http');
const Backtest = require('../modules/backtest');
const Backfill = require('../modules/backfill');

const StopLossCalculator = require('../modules/order/stop_loss_calculator');
const RiskRewardRatioCalculator = require('../modules/order/risk_reward_ratio_calculator');
const PairsHttp = require('../modules/pairs/pairs_http');
const OrderExecutor = require('../modules/order/order_executor');
const OrderCalculator = require('../modules/order/order_calculator');
const PairStateManager = require('../modules/pairs/pair_state_manager');
const PairStateExecution = require('../modules/pairs/pair_state_execution');
const PairConfig = require('../modules/pairs/pair_config');
const SystemUtil = require('../modules/system/system_util');
const TechnicalAnalysisValidator = require('../utils/technical_analysis_validator');
const WinstonSqliteTransport = require('../utils/winston_sqlite_transport');
const WinstonTelegramLogger = require('winston-telegram');
const LogsHttp = require('./system/logs_http');
const LogsRepository = require('../modules/repository/logs_repository');
const TickerLogRepository = require('../modules/repository/ticker_log_repository');
const TickerRepository = require('../modules/repository/ticker_repository');
const CandlestickResample = require('../modules/system/candlestick_resample');
const RequestClient = require('../utils/request_client');
const Throttler = require('../utils/throttler');
const Queue = require('../utils/queue');

const Bitmex = require('../exchange/bitmex');
const BitmexTestnet = require('../exchange/bitmex_testnet');
const Binance = require('../exchange/binance');
const BinanceMargin = require('../exchange/binance_margin');
const BinanceFutures = require('../exchange/binance_futures');
const BinanceFuturesCoin = require('../exchange/binance_futures_coin');
const CoinbasePro = require('../exchange/coinbase_pro');
const Bitfinex = require('../exchange/bitfinex');
const Bybit = require('../exchange/bybit');
const BybitLinear = require('../exchange/bybit_linear');
const Noop = require('../exchange/noop');

const ExchangeCandleCombine = require('../modules/exchange/exchange_candle_combine');
const CandleExportHttp = require('../modules/system/candle_export_http');
const CandleImporter = require('../modules/system/candle_importer');

const OrdersHttp = require('../modules/orders/orders_http');

let db;
let instances;
let config;
let ta;
let eventEmitter;
let logger;
let notify;
let tickers;
let queue;

let candleStickImporter;
let tickerDatabaseListener;
let tickListener;
let createOrderListener;
let exchangeOrderWatchdogListener;

let signalLogger;
let signalHttp;

let signalRepository;
let candlestickRepository;

let exchangeManager;
let backtest;
let pairStateManager;
let pairStateExecution;

let strategyManager;

let stopLossCalculator;
let riskRewardRatioCalculator;
let pairsHttp;
let orderExecutor;
let orderCalculator;
let systemUtil;
let technicalAnalysisValidator;
let logsHttp;
let logsRepository;
let tickerLogRepository;
let candlestickResample;
let exchanges;
let requestClient;
let exchangeCandleCombine;
let candleExportHttp;
let exchangePositionWatcher;
let tickerRepository;
let ordersHttp;
let pairConfig;
let throttler;

const parameters = {};

module.exports = {
  boot: async function(projectDir) {
    parameters.projectDir = projectDir;

    try {
      instances = require(`${parameters.projectDir}/instance`);
    } catch (e) {
      throw new Error(`Invalid instance.js file. Please check: ${String(e)}`);
    }

    // boot instance eg to load pairs external
    if (typeof instances.init === 'function') {
      await instances.init();
    }

    try {
      config = JSON.parse(fs.readFileSync(`${parameters.projectDir}/conf.json`, 'utf8'));
    } catch (e) {
      throw new Error(`Invalid conf.json file. Please check: ${String(e)}`);
    }

    this.getDatabase();
  },

  getDatabase: () => {
    if (db) {
      return db;
    }

    const myDb = Sqlite('bot.db');
    myDb.pragma('journal_mode = WAL');

    myDb.pragma('SYNCHRONOUS = 1;');
    myDb.pragma('LOCKING_MODE = EXCLUSIVE;');

    return (db = myDb);
  },

  getTa: function() {
    if (ta) {
      return ta;
    }

    return (ta = new Ta(this.getCandlestickRepository(), this.getInstances(), this.getTickers()));
  },

  getBacktest: function() {
    if (backtest) {
      return backtest;
    }

    return (backtest = new Backtest(
      this.getInstances(),
      this.getStrategyManager(),
      this.getExchangeCandleCombine(),
      parameters.projectDir
    ));
  },

  getStopLossCalculator: function() {
    if (stopLossCalculator) {
      return stopLossCalculator;
    }

    return (stopLossCalculator = new StopLossCalculator(this.getTickers(), this.getLogger()));
  },

  getRiskRewardRatioCalculator: function() {
    if (riskRewardRatioCalculator) {
      return riskRewardRatioCalculator;
    }

    return (riskRewardRatioCalculator = new RiskRewardRatioCalculator(this.getLogger()));
  },

  getCandleImporter: function() {
    if (candleStickImporter) {
      return candleStickImporter;
    }

    return (candleStickImporter = new CandleImporter(this.getCandlestickRepository()));
  },

  getCreateOrderListener: function() {
    if (createOrderListener) {
      return createOrderListener;
    }

    return (createOrderListener = new CreateOrderListener(this.getExchangeManager(), this.getLogger()));
  },

  getTickListener: function() {
    if (tickListener) {
      return tickListener;
    }

    return (tickListener = new TickListener(
      this.getTickers(),
      this.getInstances(),
      this.getNotifier(),
      this.getSignalLogger(),
      this.getStrategyManager(),
      this.getExchangeManager(),
      this.getPairStateManager(),
      this.getLogger(),
      this.getSystemUtil(),
      this.getOrderExecutor(),
      this.getOrderCalculator()
    ));
  },

  getExchangeOrderWatchdogListener: function() {
    if (exchangeOrderWatchdogListener) {
      return exchangeOrderWatchdogListener;
    }

    return (exchangeOrderWatchdogListener = new ExchangeOrderWatchdogListener(
      this.getExchangeManager(),
      this.getInstances(),
      this.getStopLossCalculator(),
      this.getRiskRewardRatioCalculator(),
      this.getOrderExecutor(),
      this.getPairStateManager(),
      this.getLogger(),
      this.getTickers()
    ));
  },

  getTickerDatabaseListener: function() {
    if (tickerDatabaseListener) {
      return tickerDatabaseListener;
    }

    return (tickerDatabaseListener = new TickerDatabaseListener(this.getTickerRepository()));
  },

  getSignalLogger: function() {
    if (signalLogger) {
      return signalLogger;
    }

    return (signalLogger = new SignalLogger(this.getSignalRepository()));
  },

  getSignalHttp: function() {
    if (signalHttp) {
      return signalHttp;
    }

    return (signalHttp = new SignalHttp(this.getSignalRepository()));
  },

  getSignalRepository: function() {
    if (signalRepository) {
      return signalRepository;
    }

    return (signalRepository = new SignalRepository(this.getDatabase()));
  },

  getCandlestickRepository: function() {
    if (candlestickRepository) {
      return candlestickRepository;
    }

    return (candlestickRepository = new CandlestickRepository(this.getDatabase()));
  },

  getEventEmitter: function() {
    if (eventEmitter) {
      return eventEmitter;
    }

    return (eventEmitter = new events.EventEmitter());
  },

  getLogger: function() {
    if (logger) {
      return logger;
    }

    logger = createLogger({
      format: format.combine(format.timestamp(), format.json()),
      transports: [
        new transports.File({
          filename: `${parameters.projectDir}/var/log/log.log`,
          level: 'debug'
        }),
        new transports.Console({
          level: 'error'
        }),
        new WinstonSqliteTransport({
          level: 'debug',
          database_connection: this.getDatabase(),
          table: 'logs'
        })
      ]
    });

    const config = this.getConfig();
    const telegram = _.get(config, 'log.telegram');

    if (
      telegram &&
      telegram.chatId &&
      telegram.chatId.length > 0 &&
      telegram.token &&
      telegram.token.length > 0 &&
      telegram.chatId.length > 0
    ) {
      logger.add(new WinstonTelegramLogger(telegram));
    }

    return logger;
  },

  getNotifier: function() {
    const notifiers = [];

    const config = this.getConfig();

    const slack = _.get(config, 'notify.slack');
    if (slack && slack.webhook && slack.webhook.length > 0) {
      notifiers.push(new Slack(slack));
    }

    const mailServer = _.get(config, 'notify.mail.server');
    if (mailServer && mailServer.length > 0) {
      notifiers.push(new Mail(this.createMailer(), this.getSystemUtil(), this.getLogger()));
    }

    const telegram = _.get(config, 'notify.telegram');
    if (telegram && telegram.chat_id && telegram.chat_id.length > 0 && telegram.token && telegram.token.length > 0) {
      notifiers.push(new Telegram(this.createTelegram(), telegram, this.getLogger()));
    }

    return (notify = new Notify(notifiers));
  },

  getTickers: function() {
    if (tickers) {
      return tickers;
    }

    return (tickers = new Tickers());
  },

  getStrategyManager: function() {
    if (strategyManager) {
      return strategyManager;
    }

    return (strategyManager = new StrategyManager(
      this.getTechnicalAnalysisValidator(),
      this.getExchangeCandleCombine(),
      this.getLogger(),
      parameters.projectDir
    ));
  },

  createWebserverInstance: function() {
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
      this.getOrdersHttp(),
      this.getTickers(),
      parameters.projectDir
    );
  },

  getExchangeManager: function() {
    if (exchangeManager) {
      return exchangeManager;
    }

    return (exchangeManager = new ExchangeManager(
      this.getExchanges(),
      this.getLogger(),
      this.getInstances(),
      this.getConfig()
    ));
  },

  getOrderExecutor: function() {
    if (orderExecutor) {
      return orderExecutor;
    }

    return (orderExecutor = new OrderExecutor(
      this.getExchangeManager(),
      this.getTickers(),
      this.getSystemUtil(),
      this.getLogger()
    ));
  },

  getOrderCalculator: function() {
    if (orderCalculator) {
      return orderCalculator;
    }

    return (orderCalculator = new OrderCalculator(
      this.getTickers(),
      this.getLogger(),
      this.getExchangeManager(),
      this.getPairConfig()
    ));
  },

  getHttpPairs: function() {
    if (pairsHttp) {
      return pairsHttp;
    }

    return (pairsHttp = new PairsHttp(
      this.getInstances(),
      this.getExchangeManager(),
      this.getPairStateManager(),
      this.getEventEmitter()
    ));
  },

  getPairConfig: function() {
    if (pairConfig) {
      return pairConfig;
    }

    return (pairConfig = new PairConfig(this.getInstances()));
  },

  getPairStateManager: function() {
    if (pairStateManager) {
      return pairStateManager;
    }

    return (pairStateManager = new PairStateManager(
      this.getLogger(),
      this.getPairConfig(),
      this.getSystemUtil(),
      this.getPairStateExecution(),
      this.getOrderExecutor()
    ));
  },

  getPairStateExecution: function() {
    if (pairStateExecution) {
      return pairStateExecution;
    }

    return (pairStateExecution = new PairStateExecution(
      this.getExchangeManager(),
      this.getOrderCalculator(),
      this.getOrderExecutor(),
      this.getLogger(),
      this.getTickers()
    ));
  },

  getSystemUtil: function() {
    if (systemUtil) {
      return systemUtil;
    }

    return (systemUtil = new SystemUtil(this.getConfig()));
  },

  getTechnicalAnalysisValidator: function() {
    if (technicalAnalysisValidator) {
      return technicalAnalysisValidator;
    }

    return (technicalAnalysisValidator = new TechnicalAnalysisValidator());
  },

  getLogsRepository: function() {
    if (logsRepository) {
      return logsRepository;
    }

    return (logsRepository = new LogsRepository(this.getDatabase()));
  },

  getLogsHttp: function() {
    if (logsHttp) {
      return logsHttp;
    }

    return (logsHttp = new LogsHttp(this.getLogsRepository()));
  },

  getTickerLogRepository: function() {
    if (tickerLogRepository) {
      return tickerLogRepository;
    }

    return (tickerLogRepository = new TickerLogRepository(this.getDatabase()));
  },

  getTickerRepository: function() {
    if (tickerRepository) {
      return tickerRepository;
    }

    return (tickerRepository = new TickerRepository(this.getDatabase(), this.getLogger()));
  },

  getCandlestickResample: function() {
    if (candlestickResample) {
      return candlestickResample;
    }

    return (candlestickResample = new CandlestickResample(this.getCandlestickRepository(), this.getCandleImporter()));
  },

  getRequestClient: function() {
    if (requestClient) {
      return requestClient;
    }

    return (requestClient = new RequestClient(this.getLogger()));
  },

  getQueue: function() {
    if (queue) {
      return queue;
    }

    return (queue = new Queue());
  },

  getCandleExportHttp: function() {
    if (candleExportHttp) {
      return candleExportHttp;
    }

    return (candleExportHttp = new CandleExportHttp(this.getCandlestickRepository(), this.getPairConfig()));
  },

  getOrdersHttp: function() {
    if (ordersHttp) {
      return ordersHttp;
    }

    return (ordersHttp = new OrdersHttp(
      this.getBacktest(),
      this.getTickers(),
      this.getOrderExecutor(),
      this.getExchangeManager(),
      this.getPairConfig()
    ));
  },

  getExchangeCandleCombine: function() {
    if (exchangeCandleCombine) {
      return exchangeCandleCombine;
    }

    return (exchangeCandleCombine = new ExchangeCandleCombine(this.getCandlestickRepository()));
  },

  getExchangePositionWatcher: function() {
    if (exchangePositionWatcher) {
      return exchangePositionWatcher;
    }

    return (exchangePositionWatcher = new ExchangePositionWatcher(
      this.getExchangeManager(),
      this.getEventEmitter(),
      this.getLogger()
    ));
  },

  getThrottler: function() {
    if (throttler) {
      return throttler;
    }

    return (throttler = new Throttler(this.getLogger()));
  },

  getExchanges: function() {
    if (exchanges) {
      return exchanges;
    }

    return (exchanges = [
      new Bitmex(
        this.getEventEmitter(),
        this.getRequestClient(),
        this.getCandlestickResample(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter()
      ),
      new BitmexTestnet(
        this.getEventEmitter(),
        this.getRequestClient(),
        this.getCandlestickResample(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter()
      ),
      new Binance(
        this.getEventEmitter(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter(),
        this.getThrottler()
      ),
      new BinanceMargin(
        this.getEventEmitter(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter(),
        this.getThrottler()
      ),
      new BinanceFutures(
        this.getEventEmitter(),
        this.getRequestClient(),
        this.getCandlestickResample(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter(),
        this.getThrottler()
      ),
      new BinanceFuturesCoin(
        this.getEventEmitter(),
        this.getRequestClient(),
        this.getCandlestickResample(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter(),
        this.getThrottler()
      ),
      new CoinbasePro(
        this.getEventEmitter(),
        this.getLogger(),
        this.getCandlestickResample(),
        this.getQueue(),
        this.getCandleImporter()
      ),
      new Bitfinex(
	this.getEventEmitter(),
	this.getLogger(),
	this.getRequestClient(),
	this.getCandleImporter()
      ),
      new Bybit(
        this.getEventEmitter(),
        this.getRequestClient(),
        this.getCandlestickResample(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter(),
        this.getThrottler()
      ),
      new BybitLinear(
        this.getEventEmitter(),
        this.getRequestClient(),
        this.getCandlestickResample(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter(),
        this.getThrottler()
      ),
      new Noop()
    ]);
  },

  createTradeInstance: function() {
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
      this.getSystemUtil(),
      this.getLogsRepository(),
      this.getTickerLogRepository(),
      this.getExchangePositionWatcher(),
      this.getPairStateManager()
    );
  },

  getBackfill: function() {
    return new Backfill(this.getExchanges(), this.getCandleImporter());
  },

  createMailer: function() {
    const mail = require('nodemailer');

    const config = this.getConfig();

    return mail.createTransport({
      host: config.notify.mail.server,
      port: config.notify.mail.port,
      secure: config.notify.mail.port == 465 ? true : false,
      auth: {
        user: config.notify.mail.username,
        pass: config.notify.mail.password
      }
    });
  },

  createTelegram: function() {
    const { Telegraf } = require('telegraf');
    const config = this.getConfig();
    const { token } = config.notify.telegram;

    if (!token) {
      console.log('Telegram: No api token given');
      return;
    }

    return new Telegraf(token);
  },

  getInstances: () => {
    return instances;
  },

  getConfig: () => {
    return config;
  }
};
