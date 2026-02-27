import fs from 'fs';
import path from 'path';
import events from 'events';

import { createLogger, transports, format } from 'winston';
import Sqlite from 'better-sqlite3';

import { Notify } from '../notify/notify';
import { Slack } from '../notify/slack';
import { Mail } from '../notify/mail';
import { Telegram } from '../notify/telegram';

import { Ta } from './ta';

import { SignalRepository, CandlestickRepository } from '../repository';
import { StrategyExecutor } from './strategy/v2/typed_backtest';

import { Trade } from './trade';
import { Http } from './http';

import { ConfigService } from './system/config_service';
import { DeskService } from './system/desk_service';
import { DashboardConfigService } from './system/dashboard_config_service';
import { CcxtCandlePrefillService } from './system/ccxt_candle_prefill_service';
import { CcxtCandleWatchService } from './system/ccxt_candle_watch_service';
import { SymbolSearchService } from './system/symbol_search_service';
import { ProfileService } from '../profile/profile_service';
import { ProfileOrderService } from '../profile/profile_order_service';
import { ProfilePairService } from './profile_pair_service';
import { BotRunner } from '../strategy/bot_runner';
import { TechnicalAnalysisValidator } from '../utils/technical_analysis_validator';
import { DATABASE_SCHEMA } from '../utils/database_schema';
import { WinstonSqliteTransport } from '../utils/winston_sqlite_transport';
import { LogsHttp } from './system/logs_http';
import { LogsRepository, TickerLogRepository, TickerRepository } from '../repository';
import { QueueManager } from '../utils/queue';
import { FileCache } from '../utils/file_cache';
import { BinancePriceService } from '../utils/binance_price_service';
import nodemailer from 'nodemailer';
import { Telegraf } from 'telegraf';

import { ExchangeCandleCombine } from './exchange/exchange_candle_combine';
import { ExchangeInstanceService } from './system/exchange_instance_service';
import { CandleExportHttp } from './system/candle_export_http';
import { CandleImporter } from './system/candle_importer';

// Controllers
import { DashboardController } from '../controller';
import { TradesController } from '../controller';
import { OrdersController } from '../controller';
import { SignalsController } from '../controller';
import { CandlesController } from '../controller';
import { BacktestController } from '../controller/backtest_controller';
import { LogsController } from '../controller';
import { DesksController } from '../controller';
import { CcxtExchangesController } from '../controller';
import { DashboardSettingsController } from '../controller';
import { ProfileController } from '../controller';
import { SettingsController } from '../controller';
import { TradingViewController } from '../controller/tradingview_controller';
import { StrategyBuilderController } from '../controller/strategy_builder_controller';

// V2 Strategies
import { DcaDipper } from '../strategy/strategies/dca_dipper/dca_dipper';
import { Cci } from '../strategy/strategies/cci';
import { Macd } from '../strategy/strategies/macd';
import { AwesomeOscillatorCrossZero } from '../strategy/strategies/awesome_oscillator_cross_zero';
import { ParabolicSar } from '../strategy/strategies/parabolicsar';
import { DipCatcher } from '../strategy/strategies/dip_catcher/dip_catcher';
import { CciMacd } from '../strategy/strategies/cci_macd';
import { ObvPumpDump } from '../strategy/strategies/obv_pump_dump';
import { PivotReversalStrategy } from '../strategy/strategies/pivot_reversal_strategy';
import { Trader } from '../strategy/strategies/trader';
import { Noop as NoopStrategy } from '../strategy/strategies/noop';
import { StrategyRegistry } from './strategy/v2/strategy_registry';

// Interfaces
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
  [key: string]: any;
}

interface Parameters {
  projectDir: string;
  portOverride?: number;
}

export type Logger = ReturnType<typeof createLogger>;
export { ConfigService } from './system/config_service';
export { LogsRepository, TickerLogRepository } from '../repository';
export { DeskService } from './system/desk_service';
export { SymbolSearchService } from './system/symbol_search_service';
export { ProfileService } from '../profile/profile_service';
export { ProfilePairService } from './profile_pair_service';
export { StrategyExecutor } from './strategy/v2/typed_backtest';
export { FileCache } from '../utils/file_cache';
export { BotRunner } from '../strategy/bot_runner';
export { ExchangeInstanceService } from './system/exchange_instance_service';
export { BinancePriceService } from '../utils/binance_price_service';

let db: Sqlite.Database | undefined;
let config: Config;
let ta: Ta;
let eventEmitter: events.EventEmitter;
let logger: Logger;
let notify: Notify;
let queue: QueueManager;

let candleStickImporter: CandleImporter;

let signalRepository: SignalRepository;
let candlestickRepository: CandlestickRepository;

let strategyExecutor: StrategyExecutor;

let systemUtil: ConfigService;
let technicalAnalysisValidator: TechnicalAnalysisValidator;
let logsHttp: LogsHttp;
let logsRepository: LogsRepository;
let tickerLogRepository: TickerLogRepository;
let exchangeCandleCombine: ExchangeCandleCombine;
let candleExportHttp: CandleExportHttp;
let tickerRepository: TickerRepository;
let deskService: DeskService;
let dashboardConfigService: DashboardConfigService;
let ccxtCandlePrefillService: CcxtCandlePrefillService;
let ccxtCandleWatchService: CcxtCandleWatchService;
let symbolSearchService: SymbolSearchService;
let v2StrategyRegistry: StrategyRegistry;
let profileService: ProfileService;
let profilePairService: ProfilePairService;
let fileCache: FileCache;
let botRunner: BotRunner;
let exchangeInstanceService: ExchangeInstanceService;
let binancePriceService: BinancePriceService;
let profileOrderService: ProfileOrderService;

const parameters: Parameters = {
  projectDir: ''
};

export interface Services {
  boot(projectDir: string, portOverride?: number): Promise<void>;
  getDatabase(): Sqlite.Database;
  getTa(): Ta;
  getCandleImporter(): CandleImporter;
  getSignalRepository(): SignalRepository;
  getCandlestickRepository(): CandlestickRepository;
  getEventEmitter(): events.EventEmitter;
  getLogger(): Logger;
  getNotifier(): Notify;
  getStrategyExecutor(): StrategyExecutor;
  createWebserverInstance(): Http;
  getSystemUtil(): ConfigService;
  getTechnicalAnalysisValidator(): TechnicalAnalysisValidator;
  getLogsRepository(): LogsRepository;
  getLogsHttp(): LogsHttp;
  getTickerLogRepository(): TickerLogRepository;
  getTickerRepository(): TickerRepository;
  getQueue(): QueueManager;
  getCandleExportHttp(): CandleExportHttp;
  getExchangeCandleCombine(): ExchangeCandleCombine;
  createTradeInstance(): Trade;
  createMailer(): any;
  createTelegram(): any;
  getConfig(): Config;
  // Controllers
  getDashboardController(templateHelpers: any): DashboardController;
  getDashboardSettingsController(templateHelpers: any): DashboardSettingsController;
  getDashboardConfigService(): DashboardConfigService;
  getCcxtCandlePrefillService(): CcxtCandlePrefillService;
  getCcxtCandleWatchService(): CcxtCandleWatchService;
  getTradesController(templateHelpers: any): TradesController;
  getOrdersController(templateHelpers: any): OrdersController;
  getSignalsController(templateHelpers: any): SignalsController;
  getCandlesController(templateHelpers: any): CandlesController;
  getBacktestController(templateHelpers: any): BacktestController;
  getLogsController(templateHelpers: any): LogsController;
  getDesksController(templateHelpers: any): DesksController;
  getCcxtExchangesController(templateHelpers: any): CcxtExchangesController;
  getProfileController(templateHelpers: any): ProfileController;
  getSettingsController(templateHelpers: any): SettingsController;
  getTradingViewController(templateHelpers: any): TradingViewController;
  getStrategyBuilderController(templateHelpers: any): StrategyBuilderController;
  getExchangeInstanceService(): ExchangeInstanceService;
  getProfileService(): ProfileService;
  getProfilePairService(): ProfilePairService;
  getDeskService(): DeskService;
  getSymbolSearchService(): SymbolSearchService;
  getV2StrategyRegistry(): StrategyRegistry;
  getFileCache(): FileCache;
  getBotRunner(): BotRunner;
  getBinancePriceService(): BinancePriceService;
  getProfileOrderService(): ProfileOrderService;
}

const services: Services = {
  boot: async function (projectDir: string, portOverride?: number): Promise<void> {
    parameters.projectDir = projectDir;
    parameters.portOverride = portOverride;
    this.getDatabase();
  },

  getDatabase: (): Sqlite.Database => {
    if (db) {
      return db;
    }

    const dbPath = path.join(parameters.projectDir, 'var', 'bot.db');
    const dbExists = fs.existsSync(dbPath);

    const myDb = new Sqlite(dbPath);
    myDb.pragma('journal_mode = WAL');
    myDb.pragma('SYNCHRONOUS = 1;');
    myDb.pragma('LOCKING_MODE = EXCLUSIVE;');

    if (!dbExists) {
      myDb.exec(DATABASE_SCHEMA);
    }

    return (db = myDb);
  },

  getTa: function (): Ta {
    if (ta) {
      return ta;
    }

    return (ta = new Ta(this.getCandlestickRepository()));
  },

  getCandleImporter: function (): CandleImporter {
    if (candleStickImporter) {
      return candleStickImporter;
    }

    return (candleStickImporter = new CandleImporter(this.getCandlestickRepository()));
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

    return logger;
  },

  getNotifier: function (): Notify {
    const notifiers: Array<Slack | Mail | Telegram> = [];

    const config = this.getConfig();

    const slack = config?.notify?.slack;
    if (slack && slack.webhook && slack.webhook.length > 0) {
      notifiers.push(new Slack(slack));
    }

    const mailServer = config?.notify?.mail?.server;
    if (mailServer && mailServer.length > 0) {
      notifiers.push(new Mail(this.createMailer(), this.getSystemUtil(), this.getLogger()));
    }

    const telegram = config?.notify?.telegram;
    if (telegram && telegram.chat_id && telegram.chat_id.length > 0 && telegram.token && telegram.token.length > 0) {
      notifiers.push(new Telegram(this.createTelegram(), telegram, this.getLogger()));
    }

    return (notify = new Notify(notifiers));
  },


  getStrategyExecutor: function (): StrategyExecutor {
    if (strategyExecutor) {
      return strategyExecutor;
    }

    return (strategyExecutor = new StrategyExecutor(
      this.getTechnicalAnalysisValidator(),
      this.getExchangeCandleCombine(),
      this.getLogger(),
      this.getCcxtCandleWatchService(),
      this.getCcxtCandlePrefillService(),
      this.getV2StrategyRegistry()
    ));
  },

  createWebserverInstance: function (): Http {
    return new Http(this.getSystemUtil(), parameters.projectDir, this, parameters.portOverride);
  },

  getSystemUtil: function (): ConfigService {
    if (systemUtil) {
      return systemUtil;
    }

    return (systemUtil = new ConfigService(parameters.projectDir));
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

    return (candleExportHttp = new CandleExportHttp(this.getCandlestickRepository(), this.getCcxtCandleWatchService()));
  },

  getExchangeCandleCombine: function (): ExchangeCandleCombine {
    if (exchangeCandleCombine) {
      return exchangeCandleCombine;
    }

    return (exchangeCandleCombine = new ExchangeCandleCombine(this.getCandlestickRepository()));
  },

  createTradeInstance: function (): Trade {
    return new Trade(
      this.getNotifier(),
      this.getLogger(),
      this.getLogsRepository(),
      this.getTickerLogRepository(),
      this.getBotRunner()
    );
  },

  createMailer: function (): any {
    const config = this.getConfig();

    return nodemailer.createTransport({
      host: config.notify?.mail?.server,
      port: config.notify?.mail?.port,
      secure: config.notify?.mail?.port === 465,
      auth: {
        user: config.notify?.mail?.username,
        pass: config.notify?.mail?.password
      }
    });
  },

  createTelegram: function (): any {
    const config = this.getConfig();
    const { token } = config.notify?.telegram || {};

    if (!token) {
      this.getLogger().info('Telegram: No api token given');
      return;
    }

    return new Telegraf(token);
  },

  getConfig: (): Config => {
    return config;
  },

  // Controller factory methods
  getDashboardController: function (templateHelpers: any): DashboardController {
    return new DashboardController(templateHelpers, this.getTa(), this.getDashboardConfigService());
  },

  getDashboardSettingsController: function (templateHelpers: any): DashboardSettingsController {
    return new DashboardSettingsController(templateHelpers, this.getDashboardConfigService(), this.getProfilePairService(), this.getCcxtCandlePrefillService(), this.getCcxtCandleWatchService());
  },

  getDashboardConfigService: function (): DashboardConfigService {
    if (dashboardConfigService) {
      return dashboardConfigService;
    }
    return (dashboardConfigService = new DashboardConfigService(this.getSystemUtil()));
  },

  getCcxtCandlePrefillService: function (): CcxtCandlePrefillService {
    if (ccxtCandlePrefillService) {
      return ccxtCandlePrefillService;
    }
    return (ccxtCandlePrefillService = new CcxtCandlePrefillService(this.getCandleImporter(), this.getLogger(), this.getExchangeInstanceService()));
  },

  getCcxtCandleWatchService: function (): CcxtCandleWatchService {
    if (ccxtCandleWatchService) {
      return ccxtCandleWatchService;
    }
    return (ccxtCandleWatchService = new CcxtCandleWatchService(this.getCandleImporter(), this.getDashboardConfigService(), this.getLogger(), this.getProfileService()));
  },

  getTradesController: function (templateHelpers: any): TradesController {
    return new TradesController(templateHelpers, this.getProfileService());
  },

  getOrdersController: function (templateHelpers: any): OrdersController {
    return new OrdersController(templateHelpers, this.getProfileService(), this.getProfilePairService());
  },

  getSignalsController: function (templateHelpers: any): SignalsController {
    return new SignalsController(templateHelpers, this.getSignalRepository());
  },

  getCandlesController: function (templateHelpers: any): CandlesController {
    return new CandlesController(templateHelpers, this.getCandleExportHttp(), this.getCandleImporter());
  },

  getBacktestController: function (templateHelpers: any): BacktestController {
    return new BacktestController(templateHelpers, this.getExchangeCandleCombine(), this.getV2StrategyRegistry(), this.getStrategyExecutor(), this.getCcxtCandleWatchService());
  },

  getLogsController: function (templateHelpers: any): LogsController {
    return new LogsController(templateHelpers, this.getLogsHttp());
  },

  getDesksController: function (templateHelpers: any): DesksController {
    return new DesksController(templateHelpers, this.getDeskService(), this.getSymbolSearchService());
  },

  getCcxtExchangesController: function (templateHelpers: any): CcxtExchangesController {
    return new CcxtExchangesController(templateHelpers, this.getExchangeInstanceService());
  },

  getProfileController: function (templateHelpers: any): ProfileController {
    return new ProfileController(templateHelpers, this.getProfileService(), this.getProfilePairService(), this.getV2StrategyRegistry(), this.getCcxtCandleWatchService());
  },

  getSettingsController: function (templateHelpers: any): SettingsController {
    return new SettingsController(templateHelpers, this.getSystemUtil());
  },

  getTradingViewController: function (templateHelpers: any): TradingViewController {
    return new TradingViewController(templateHelpers);
  },

  getStrategyBuilderController: function (templateHelpers: any): StrategyBuilderController {
    return new StrategyBuilderController(
      templateHelpers,
      this.getSystemUtil(),
      this.getProfilePairService(),
      this.getExchangeCandleCombine(),
      this.getStrategyExecutor(),
      parameters.projectDir
    );
  },

  getExchangeInstanceService: function (): ExchangeInstanceService {
    if (exchangeInstanceService) {
      return exchangeInstanceService;
    }
    return (exchangeInstanceService = new ExchangeInstanceService());
  },

  getProfileService: function (): ProfileService {
    if (profileService) {
      return profileService;
    }

    return (profileService = new ProfileService(
      this.getSystemUtil(),
      this.getExchangeInstanceService(),
      this.getBinancePriceService(),
      this.getProfileOrderService()
    ));
  },

  getProfilePairService: function (): ProfilePairService {
    if (profilePairService) {
      return profilePairService;
    }

    return (profilePairService = new ProfilePairService(this.getFileCache(), this.getExchangeInstanceService()));
  },

  getDeskService: function (): DeskService {
    if (deskService) {
      return deskService;
    }

    return (deskService = new DeskService(this.getSystemUtil()));
  },

  getSymbolSearchService: function (): SymbolSearchService {
    if (symbolSearchService) {
      return symbolSearchService;
    }

    return (symbolSearchService = new SymbolSearchService());
  },

  getV2StrategyRegistry: function (): StrategyRegistry {
    if (v2StrategyRegistry) {
      return v2StrategyRegistry;
    }

    return (v2StrategyRegistry = new StrategyRegistry([
      DcaDipper,
      Cci,
      Macd,
      AwesomeOscillatorCrossZero,
      ParabolicSar,
      DipCatcher,
      CciMacd,
      ObvPumpDump,
      PivotReversalStrategy,
      Trader,
      NoopStrategy,
    ]));
  },

  getFileCache: function (): FileCache {
    if (fileCache) {
      return fileCache;
    }

    return (fileCache = new FileCache());
  },

  getBotRunner: function (): BotRunner {
    if (botRunner) {
      return botRunner;
    }

    return (botRunner = new BotRunner(
      this.getProfileService(),
      this.getStrategyExecutor(),
      this.getNotifier(),
      this.getSignalRepository(),
      this.getLogger()
    ));
  },

  getBinancePriceService: function (): BinancePriceService {
    if (binancePriceService) {
      return binancePriceService;
    }

    return (binancePriceService = new BinancePriceService(this.getFileCache()));
  },

  getProfileOrderService: function (): ProfileOrderService {
    if (profileOrderService) {
      return profileOrderService;
    }

    return (profileOrderService = new ProfileOrderService(this.getLogger()));
  }
};

export default services;
