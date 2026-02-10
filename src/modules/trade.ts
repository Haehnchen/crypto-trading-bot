import moment from 'moment';
import crypto from 'crypto';
import os from 'os';
import { PositionStateChangeEvent } from '../event/position_state_change_event';
import { EventEmitter } from 'events';

export class Trade {
  private eventEmitter: EventEmitter;
  private instances: { symbols: { exchange: string; symbol: string }[] };
  private notify: any;
  private logger: any;
  private createOrderListener: any;
  private tickListener: any;
  private tickers: any;
  private tickerDatabaseListener: any;
  private exchangeOrderWatchdogListener: any;
  private systemUtil: any;
  private logsRepository: any;
  private tickerLogRepository: any;
  private exchangePositionWatcher: any;
  private pairStateManager: any;

  constructor(
    eventEmitter: EventEmitter,
    instances: { symbols: { exchange: string; symbol: string }[] },
    notify: any,
    logger: any,
    createOrderListener: any,
    tickListener: any,
    tickers: any,
    tickerDatabaseListener: any,
    exchangeOrderWatchdogListener: any,
    systemUtil: any,
    logsRepository: any,
    tickerLogRepository: any,
    exchangePositionWatcher: any,
    pairStateManager: any
  ) {
    this.eventEmitter = eventEmitter;
    this.instances = instances;
    this.notify = notify;
    this.logger = logger;
    this.createOrderListener = createOrderListener;
    this.tickListener = tickListener;
    this.tickers = tickers;
    this.tickerDatabaseListener = tickerDatabaseListener;
    this.exchangeOrderWatchdogListener = exchangeOrderWatchdogListener;
    this.systemUtil = systemUtil;
    this.logsRepository = logsRepository;
    this.tickerLogRepository = tickerLogRepository;
    this.exchangePositionWatcher = exchangePositionWatcher;
    this.pairStateManager = pairStateManager;
  }

  start(): void {
    this.logger.debug('Trade module started');

    process.on('SIGINT', async () => {
      // force exit in any case
      setTimeout(() => {
        process.exit();
      }, 7500);

      await this.pairStateManager.onTerminate();

      process.exit();
    });

    const instanceId = crypto.randomBytes(4).toString('hex');

    const notifyActivePairs = this.instances.symbols.map(symbol => {
      return `${symbol.exchange}.${symbol.symbol}`;
    });

    const message = `Start: ${instanceId} - ${os.hostname()} - ${os.platform()} - ${moment().format()} - ${notifyActivePairs.join(
      ', '
    )}`;

    this.notify.send(message);

    const me = this;
    const { eventEmitter } = this;

    // let the system bootup; eg let the candle be filled by exchanges
    setTimeout(() => {
      console.log('Trade module: warmup done; starting ticks');
      this.logger.info('Trade module: warmup done; starting ticks');

      setTimeout(async () => {
        await me.tickListener.startStrategyIntervals();
      }, 1000);

      // order create tick
      setInterval(() => {
        eventEmitter.emit('signal_tick', {});
      }, this.systemUtil.getConfig('tick.signal', 10600));

      setInterval(() => {
        eventEmitter.emit('watchdog', {});
      }, this.systemUtil.getConfig('tick.watchdog', 30800));

      setInterval(() => {
        eventEmitter.emit('tick_ordering', {});
      }, this.systemUtil.getConfig('tick.ordering', 10800));
    }, this.systemUtil.getConfig('tick.warmup', 30000));

    // cronjob like tasks
    setInterval(async () => {
      await me.logsRepository.cleanOldLogEntries();
      await me.tickerLogRepository.cleanOldLogEntries();

      me.logger.debug('Logs: Cleanup old entries');
    }, 86455000);

    const { tickers } = this;

    eventEmitter.on('ticker', async (tickerEvent: any) => {
      tickers.set(tickerEvent.ticker);
      me.tickerDatabaseListener.onTicker(tickerEvent);
    });

    eventEmitter.on('orderbook', (orderbookEvent: any) => {
      // console.log(orderbookEvent.orderbook)
    });

    eventEmitter.on('order', async (event: any) => me.createOrderListener.onCreateOrder(event));

    eventEmitter.on('tick', async () => {
      me.tickListener.onTick();
    });

    eventEmitter.on('watchdog', async () => {
      me.exchangeOrderWatchdogListener.onTick();
      await me.exchangePositionWatcher.onPositionStateChangeTick();
    });

    eventEmitter.on(PositionStateChangeEvent.EVENT_NAME, async (event: any) => {
      await me.exchangeOrderWatchdogListener.onPositionChanged(event);
    });
  }
}
