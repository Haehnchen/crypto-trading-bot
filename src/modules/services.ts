import fs from 'fs';
import events from 'events';

import { createLogger, transports, format } from 'winston';
import _ from 'lodash';
import Sqlite from 'better-sqlite3';

import { Notify } from '../notify/notify';
import { Slack } from '../notify/slack';
import { Mail } from '../notify/mail';
import { Telegram } from '../notify/telegram';

import { Tickers } from '../storage/tickers';
import { Ta } from './ta';

import { TickListener } from './listener/tick_listener';
import { CreateOrderListener } from './listener/create_order_listener';
import { TickerDatabaseListener } from './listener/ticker_database_listener';
import { ExchangeOrderWatchdogListener } from './listener/exchange_order_watchdog_listener';
import { ExchangePositionWatcher } from './exchange/exchange_position_watcher';

import { SignalLogger } from './signal/signal_logger';
import { SignalHttp } from './signal/signal_http';

import { SignalRepository, CandlestickRepository } from '../repository';
import { StrategyManager } from './strategy/strategy_manager';
import { ExchangeManager } from './exchange/exchange_manager';

import { Trade } from './trade';
import { Http } from './http';
import { Backtest } from './backtest';
import { Backfill } from './backfill';

import { StopLossCalculator } from './order/stop_loss_calculator';
import { RiskRewardRatioCalculator } from './order/risk_reward_ratio_calculator';
import { PairsHttp } from './pairs/pairs_http';
import { OrderExecutor } from './order/order_executor';
import { OrderCalculator } from './order/order_calculator';
import { PairStateManager } from './pairs/pair_state_manager';
import { PairStateExecution } from './pairs/pair_state_execution';
import { PairConfig } from './pairs/pair_config';
import { SystemUtil } from './system/system_util';
import { TechnicalAnalysisValidator } from '../utils/technical_analysis_validator';
import { WinstonSqliteTransport } from '../utils/winston_sqlite_transport';
import WinstonTelegramLogger from 'winston-telegram';
import { LogsHttp } from './system/logs_http';
import { LogsRepository, TickerLogRepository, TickerRepository } from '../repository';
import { CandlestickResample } from './system/candlestick_resample';
import { RequestClient } from '../utils/request_client';
import { Throttler } from '../utils/throttler';
import { QueueManager } from '../utils/queue';

import { Bitmex } from '../exchange/bitmex';
import { BitmexTestnet } from '../exchange/bitmex_testnet';
import { Binance } from '../exchange/binance';
import { BinanceMargin } from '../exchange/binance_margin';
import { BinanceFutures } from '../exchange/binance_futures';
import { BinanceFuturesCoin } from '../exchange/binance_futures_coin';
import { CoinbasePro } from '../exchange/coinbase_pro';
import { Bitfinex } from '../exchange/bitfinex';
import { Bybit } from '../exchange/bybit';
import { BybitUnified } from '../exchange/bybit_unified';
import { Noop } from '../exchange/noop';

import { ExchangeCandleCombine } from './exchange/exchange_candle_combine';
import { CandleExportHttp } from './system/candle_export_http';
import { CandleImporter } from './system/candle_importer';

import { OrdersHttp } from './orders/orders_http';

// Controllers
import { DashboardController } from '../controller';
import { TradesController } from '../controller';
import { PairsController } from '../controller';
import { OrdersController } from '../controller';
import { SignalsController } from '../controller';
import { CandlesController } from '../controller';
import { BacktestController } from '../controller';
import { LogsController } from '../controller';
import { DesksController } from '../controller';
import { TradingViewController } from '../controller';

// Interfaces
interface Instances {
  init?: () => Promise<void>;
  [key: string]: any;
}

interface Config {
  notify?: {
    slack?: {
      webhook?: string;
    };
    mail?: {
      server?: string;
      port?: number;
      username?: string;
      password?: string;
    };
    telegram?: {
      token?: string;
      chat_id?: string;
    };
  };
  log?: {
    telegram?: {
      chatId?: string;
      token?: string;
    };
  };
  [key: string]: any;
}

interface Parameters {
  projectDir: string;
}

export type Logger = ReturnType<typeof createLogger>;
export { SystemUtil } from './system/system_util';
export { PairStateManager } from './pairs/pair_state_manager';
export { Tickers } from '../storage/tickers';
export { CreateOrderListener } from './listener/create_order_listener';
export { TickListener } from './listener/tick_listener';
export { TickerDatabaseListener } from './listener/ticker_database_listener';
export { ExchangeOrderWatchdogListener } from './listener/exchange_order_watchdog_listener';
export { LogsRepository, TickerLogRepository } from '../repository';
export { ExchangePositionWatcher } from './exchange/exchange_position_watcher';
export { StrategyManager } from './strategy/strategy_manager';
export { SignalLogger } from './signal/signal_logger';
export { OrderExecutor } from './order/order_executor';
export { OrderCalculator } from './order/order_calculator';
export { Backtest } from './backtest';
export { PairConfig } from './pairs/pair_config';

let db: Sqlite.Database | undefined;
let instances: Instances;
let config: Config;
let ta: Ta;
let eventEmitter: events.EventEmitter;
let logger: Logger;
let notify: Notify;
let tickers: Tickers;
let queue: QueueManager;

let candleStickImporter: CandleImporter;
let tickerDatabaseListener: TickerDatabaseListener;
let tickListener: TickListener;
let createOrderListener: CreateOrderListener;
let exchangeOrderWatchdogListener: ExchangeOrderWatchdogListener;

let signalLogger: SignalLogger;
let signalHttp: SignalHttp;

let signalRepository: SignalRepository;
let candlestickRepository: CandlestickRepository;

let exchangeManager: ExchangeManager;
let backtest: Backtest;
let pairStateManager: PairStateManager;
let pairStateExecution: PairStateExecution;

let strategyManager: StrategyManager;

let stopLossCalculator: StopLossCalculator;
let riskRewardRatioCalculator: RiskRewardRatioCalculator;
let pairsHttp: PairsHttp;
let orderExecutor: OrderExecutor;
let orderCalculator: OrderCalculator;
let systemUtil: SystemUtil;
let technicalAnalysisValidator: TechnicalAnalysisValidator;
let logsHttp: LogsHttp;
let logsRepository: LogsRepository;
let tickerLogRepository: TickerLogRepository;
let candlestickResample: CandlestickResample;
let exchanges: Array<
  Bitmex | BitmexTestnet | Binance | BinanceMargin | BinanceFutures | BinanceFuturesCoin | CoinbasePro | Bitfinex | Bybit | BybitUnified | Noop
>;
let requestClient: RequestClient;
let exchangeCandleCombine: ExchangeCandleCombine;
let candleExportHttp: CandleExportHttp;
let exchangePositionWatcher: ExchangePositionWatcher;
let tickerRepository: TickerRepository;
let ordersHttp: OrdersHttp;
let pairConfig: PairConfig;
let throttler: Throttler;

const parameters: Parameters = {
  projectDir: ''
};

export interface Services {
  boot(projectDir: string): Promise<void>;
  getDatabase(): Sqlite.Database;
  getTa(): Ta;
  getBacktest(): Backtest;
  getStopLossCalculator(): StopLossCalculator;
  getRiskRewardRatioCalculator(): RiskRewardRatioCalculator;
  getCandleImporter(): CandleImporter;
  getCreateOrderListener(): CreateOrderListener;
  getTickListener(): TickListener;
  getExchangeOrderWatchdogListener(): ExchangeOrderWatchdogListener;
  getTickerDatabaseListener(): TickerDatabaseListener;
  getSignalLogger(): SignalLogger;
  getSignalHttp(): SignalHttp;
  getSignalRepository(): SignalRepository;
  getCandlestickRepository(): CandlestickRepository;
  getEventEmitter(): events.EventEmitter;
  getLogger(): Logger;
  getNotifier(): Notify;
  getTickers(): Tickers;
  getStrategyManager(): StrategyManager;
  createWebserverInstance(): Http;
  getExchangeManager(): ExchangeManager;
  getOrderExecutor(): OrderExecutor;
  getOrderCalculator(): OrderCalculator;
  getHttpPairs(): PairsHttp;
  getPairConfig(): PairConfig;
  getPairStateManager(): PairStateManager;
  getPairStateExecution(): PairStateExecution;
  getSystemUtil(): SystemUtil;
  getTechnicalAnalysisValidator(): TechnicalAnalysisValidator;
  getLogsRepository(): LogsRepository;
  getLogsHttp(): LogsHttp;
  getTickerLogRepository(): TickerLogRepository;
  getTickerRepository(): TickerRepository;
  getCandlestickResample(): CandlestickResample;
  getRequestClient(): RequestClient;
  getQueue(): QueueManager;
  getCandleExportHttp(): CandleExportHttp;
  getOrdersHttp(): OrdersHttp;
  getExchangeCandleCombine(): ExchangeCandleCombine;
  getExchangePositionWatcher(): ExchangePositionWatcher;
  getThrottler(): Throttler;
  getExchanges(): Array<
    Bitmex | BitmexTestnet | Binance | BinanceMargin | BinanceFutures | BinanceFuturesCoin | CoinbasePro | Bitfinex | Bybit | BybitUnified | Noop
  >;
  createTradeInstance(): Trade;
  getBackfill(): Backfill;
  createMailer(): any;
  createTelegram(): any;
  getInstances(): Instances;
  getConfig(): Config;
  // Controllers
  getDashboardController(templateHelpers: any): DashboardController;
  getTradesController(templateHelpers: any): TradesController;
  getPairsController(templateHelpers: any): PairsController;
  getOrdersController(templateHelpers: any): OrdersController;
  getSignalsController(templateHelpers: any): SignalsController;
  getCandlesController(templateHelpers: any): CandlesController;
  getBacktestController(templateHelpers: any): BacktestController;
  getLogsController(templateHelpers: any): LogsController;
  getDesksController(templateHelpers: any): DesksController;
  getTradingViewController(templateHelpers: any): TradingViewController;
}

const services: Services = {
  boot: async function (projectDir: string): Promise<void> {
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

  getDatabase: (): Sqlite.Database => {
    if (db) {
      return db;
    }

    const myDb = new Sqlite('bot.db');
    myDb.pragma('journal_mode = WAL');

    myDb.pragma('SYNCHRONOUS = 1;');
    myDb.pragma('LOCKING_MODE = EXCLUSIVE;');

    return (db = myDb);
  },

  getTa: function (): Ta {
    if (ta) {
      return ta;
    }

    return (ta = new Ta(this.getCandlestickRepository(), this.getInstances(), this.getTickers()));
  },

  getBacktest: function (): Backtest {
    if (backtest) {
      return backtest;
    }

    return (backtest = new Backtest(this.getInstances(), this.getStrategyManager(), this.getExchangeCandleCombine(), parameters.projectDir));
  },

  getStopLossCalculator: function (): StopLossCalculator {
    if (stopLossCalculator) {
      return stopLossCalculator;
    }

    return (stopLossCalculator = new StopLossCalculator(this.getTickers(), this.getLogger()));
  },

  getRiskRewardRatioCalculator: function (): RiskRewardRatioCalculator {
    if (riskRewardRatioCalculator) {
      return riskRewardRatioCalculator;
    }

    return (riskRewardRatioCalculator = new RiskRewardRatioCalculator(this.getLogger()));
  },

  getCandleImporter: function (): CandleImporter {
    if (candleStickImporter) {
      return candleStickImporter;
    }

    return (candleStickImporter = new CandleImporter(this.getCandlestickRepository()));
  },

  getCreateOrderListener: function (): CreateOrderListener {
    if (createOrderListener) {
      return createOrderListener;
    }

    return (createOrderListener = new CreateOrderListener(this.getExchangeManager(), this.getLogger()));
  },

  getTickListener: function (): TickListener {
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

  getExchangeOrderWatchdogListener: function (): ExchangeOrderWatchdogListener {
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

  getTickerDatabaseListener: function (): TickerDatabaseListener {
    if (tickerDatabaseListener) {
      return tickerDatabaseListener;
    }

    return (tickerDatabaseListener = new TickerDatabaseListener(this.getTickerRepository()));
  },

  getSignalLogger: function (): SignalLogger {
    if (signalLogger) {
      return signalLogger;
    }

    return (signalLogger = new SignalLogger(this.getSignalRepository()));
  },

  getSignalHttp: function (): SignalHttp {
    if (signalHttp) {
      return signalHttp;
    }

    return (signalHttp = new SignalHttp(this.getSignalRepository()));
  },

  getSignalRepository: function (): SignalRepository {
    if (signalRepository) {
      return signalRepository;
    }

    return (signalRepository = new SignalRepository(this.getDatabase()));
  },

  getCandlestickRepository: function (): CandlestickRepository {
    if (candlestickRepository) {
      return candlestickRepository;
    }

    return (candlestickRepository = new CandlestickRepository(this.getDatabase()));
  },

  getEventEmitter: function (): events.EventEmitter {
    if (eventEmitter) {
      return eventEmitter;
    }

    return (eventEmitter = new events.EventEmitter());
  },

  getLogger: function (): Logger {
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
    }) as unknown as Logger;

    const config = this.getConfig();
    const telegram = _.get(config, 'log.telegram');

    if (telegram && telegram.chatId && telegram.chatId.length > 0 && telegram.token && telegram.token.length > 0 && telegram.chatId.length > 0) {
      if (logger.add) {
        logger.add(new WinstonTelegramLogger(telegram));
      }
    }

    return logger;
  },

  getNotifier: function (): Notify {
    const notifiers: Array<Slack | Mail | Telegram> = [];

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

  getTickers: function (): Tickers {
    if (tickers) {
      return tickers;
    }

    return (tickers = new Tickers());
  },

  getStrategyManager: function (): StrategyManager {
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

  createWebserverInstance: function (): Http {
    return new Http(this.getSystemUtil(), parameters.projectDir, this);
  },

  getExchangeManager: function (): ExchangeManager {
    if (exchangeManager) {
      return exchangeManager;
    }

    return (exchangeManager = new ExchangeManager(this.getExchanges(), this.getLogger(), this.getInstances(), this.getConfig()));
  },

  getOrderExecutor: function (): OrderExecutor {
    if (orderExecutor) {
      return orderExecutor;
    }

    return (orderExecutor = new OrderExecutor(this.getExchangeManager(), this.getTickers(), this.getSystemUtil(), this.getLogger()));
  },

  getOrderCalculator: function (): OrderCalculator {
    if (orderCalculator) {
      return orderCalculator;
    }

    return (orderCalculator = new OrderCalculator(this.getTickers(), this.getLogger(), this.getExchangeManager(), this.getPairConfig()));
  },

  getHttpPairs: function (): PairsHttp {
    if (pairsHttp) {
      return pairsHttp;
    }

    return (pairsHttp = new PairsHttp(this.getInstances(), this.getExchangeManager(), this.getPairStateManager(), this.getEventEmitter()));
  },

  getPairConfig: function (): PairConfig {
    if (pairConfig) {
      return pairConfig;
    }

    return (pairConfig = new PairConfig(this.getInstances()));
  },

  getPairStateManager: function (): PairStateManager {
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

  getPairStateExecution: function (): PairStateExecution {
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

  getSystemUtil: function (): SystemUtil {
    if (systemUtil) {
      return systemUtil;
    }

    return (systemUtil = new SystemUtil(this.getConfig()));
  },

  getTechnicalAnalysisValidator: function (): TechnicalAnalysisValidator {
    if (technicalAnalysisValidator) {
      return technicalAnalysisValidator;
    }

    return (technicalAnalysisValidator = new TechnicalAnalysisValidator());
  },

  getLogsRepository: function (): LogsRepository {
    if (logsRepository) {
      return logsRepository;
    }

    return (logsRepository = new LogsRepository(this.getDatabase()));
  },

  getLogsHttp: function (): LogsHttp {
    if (logsHttp) {
      return logsHttp;
    }

    return (logsHttp = new LogsHttp(this.getLogsRepository()));
  },

  getTickerLogRepository: function (): TickerLogRepository {
    if (tickerLogRepository) {
      return tickerLogRepository;
    }

    return (tickerLogRepository = new TickerLogRepository(this.getDatabase()));
  },

  getTickerRepository: function (): TickerRepository {
    if (tickerRepository) {
      return tickerRepository;
    }

    return (tickerRepository = new TickerRepository(this.getDatabase(), this.getLogger()));
  },

  getCandlestickResample: function (): CandlestickResample {
    if (candlestickResample) {
      return candlestickResample;
    }

    return (candlestickResample = new CandlestickResample(this.getCandlestickRepository(), this.getCandleImporter()));
  },

  getRequestClient: function (): RequestClient {
    if (requestClient) {
      return requestClient;
    }

    return (requestClient = new RequestClient(this.getLogger()));
  },

  getQueue: function (): QueueManager {
    if (queue) {
      return queue;
    }

    return (queue = new QueueManager());
  },

  getCandleExportHttp: function (): CandleExportHttp {
    if (candleExportHttp) {
      return candleExportHttp;
    }

    return (candleExportHttp = new CandleExportHttp(this.getCandlestickRepository(), this.getPairConfig()));
  },

  getOrdersHttp: function (): OrdersHttp {
    if (ordersHttp) {
      return ordersHttp;
    }

    return (ordersHttp = new OrdersHttp(this.getBacktest(), this.getTickers(), this.getOrderExecutor(), this.getExchangeManager(), this.getPairConfig()));
  },

  getExchangeCandleCombine: function (): ExchangeCandleCombine {
    if (exchangeCandleCombine) {
      return exchangeCandleCombine;
    }

    return (exchangeCandleCombine = new ExchangeCandleCombine(this.getCandlestickRepository()));
  },

  getExchangePositionWatcher: function (): ExchangePositionWatcher {
    if (exchangePositionWatcher) {
      return exchangePositionWatcher;
    }

    return (exchangePositionWatcher = new ExchangePositionWatcher(this.getExchangeManager(), this.getEventEmitter(), this.getLogger()));
  },

  getThrottler: function (): Throttler {
    if (throttler) {
      return throttler;
    }

    return (throttler = new Throttler(this.getLogger()));
  },

  getExchanges: function (): Array<
    Bitmex | BitmexTestnet | Binance | BinanceMargin | BinanceFutures | BinanceFuturesCoin | CoinbasePro | Bitfinex | Bybit | BybitUnified | Noop
  > {
    if (exchanges) {
      return exchanges;
    }

    return (exchanges = [
      new Bitmex(this.getEventEmitter(), this.getRequestClient(), this.getCandlestickResample(), this.getLogger(), this.getQueue(), this.getCandleImporter()),
      new BitmexTestnet(
        this.getEventEmitter(),
        this.getRequestClient(),
        this.getCandlestickResample(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter()
      ),
      new Binance(this.getEventEmitter(), this.getLogger(), this.getQueue(), this.getCandleImporter(), this.getThrottler()),
      new BinanceMargin(this.getEventEmitter(), this.getLogger(), this.getQueue(), this.getCandleImporter(), this.getThrottler()),
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
      new CoinbasePro(this.getEventEmitter(), this.getLogger(), this.getCandlestickResample(), this.getQueue(), this.getCandleImporter()),
      new Bitfinex(this.getEventEmitter(), this.getLogger(), this.getRequestClient(), this.getCandleImporter()),
      new Bybit(
        this.getEventEmitter(),
        this.getRequestClient(),
        this.getCandlestickResample(),
        this.getLogger(),
        this.getQueue(),
        this.getCandleImporter(),
        this.getThrottler()
      ),
      new BybitUnified(
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

  createTradeInstance: function (): Trade {
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

  getBackfill: function (): Backfill {
    return new Backfill(this.getExchanges(), this.getCandleImporter());
  },

  createMailer: function (): any {
    const mail = require('nodemailer');

    const config = this.getConfig();

    return mail.createTransport({
      host: config.notify?.mail?.server,
      port: config.notify?.mail?.port,
      secure: config.notify?.mail?.port == 465,
      auth: {
        user: config.notify?.mail?.username,
        pass: config.notify?.mail?.password
      }
    });
  },

  createTelegram: function (): any {
    const { Telegraf } = require('telegraf');
    const config = this.getConfig();
    const { token } = config.notify?.telegram || {};

    if (!token) {
      console.log('Telegram: No api token given');
      return;
    }

    return new Telegraf(token);
  },

  getInstances: (): Instances => {
    return instances;
  },

  getConfig: (): Config => {
    return config;
  },

  // Controller factory methods
  getDashboardController: function (templateHelpers: any): DashboardController {
    return new DashboardController(templateHelpers, this.getTa(), this.getSystemUtil());
  },

  getTradesController: function (templateHelpers: any): TradesController {
    return new TradesController(templateHelpers, this.getExchangeManager(), this.getOrdersHttp(), this.getTickers());
  },

  getPairsController: function (templateHelpers: any): PairsController {
    return new PairsController(templateHelpers, this.getHttpPairs());
  },

  getOrdersController: function (templateHelpers: any): OrdersController {
    return new OrdersController(templateHelpers, this.getOrdersHttp(), this.getExchangeManager());
  },

  getSignalsController: function (templateHelpers: any): SignalsController {
    return new SignalsController(templateHelpers, this.getSignalHttp());
  },

  getCandlesController: function (templateHelpers: any): CandlesController {
    return new CandlesController(templateHelpers, this.getCandleExportHttp(), this.getCandleImporter());
  },

  getBacktestController: function (templateHelpers: any): BacktestController {
    return new BacktestController(templateHelpers, this.getBacktest());
  },

  getLogsController: function (templateHelpers: any): LogsController {
    return new LogsController(templateHelpers, this.getLogsHttp());
  },

  getDesksController: function (templateHelpers: any): DesksController {
    return new DesksController(templateHelpers, this.getSystemUtil());
  },

  getTradingViewController: function (templateHelpers: any): TradingViewController {
    return new TradingViewController(templateHelpers);
  }
};

export default services;
