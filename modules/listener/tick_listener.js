const moment = require('moment');
const _ = require('lodash');
const PQueue = require('p-queue');
const StrategyContext = require('../../dict/strategy_context');

module.exports = class TickListener {
  constructor(
    tickers,
    instances,
    notifier,
    signalLogger,
    strategyManager,
    exchangeManager,
    pairStateManager,
    logger,
    systemUtil
  ) {
    this.tickers = tickers;
    this.instances = instances;
    this.notifier = notifier;
    this.signalLogger = signalLogger;
    this.strategyManager = strategyManager;
    this.exchangeManager = exchangeManager;
    this.pairStateManager = pairStateManager;
    this.logger = logger;
    this.systemUtil = systemUtil;

    this.notified = {};
  }

  async visitStrategy(strategy, symbol) {
    const ticker = this.tickers.get(symbol.exchange, symbol.symbol);

    if (!ticker) {
      console.error(`Ticker no found for + ${symbol.exchange}${symbol.symbol}`);
      return;
    }

    const strategyKey = strategy.strategy;

    let context = StrategyContext.create(ticker);
    const position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol);
    if (position) {
      context = StrategyContext.createFromPosition(ticker, position);
    }

    const result = await this.strategyManager.executeStrategy(
      strategyKey,
      context,
      symbol.exchange,
      symbol.symbol,
      strategy.options || {}
    );
    if (!result) {
      return;
    }

    const signal = result.getSignal();
    if (!signal || typeof signal === 'undefined') {
      return;
    }

    if (!['close', 'short', 'long'].includes(signal)) {
      throw `Invalid signal: ${JSON.stringify(signal, strategy)}`;
    }

    const signalWindow = moment()
      .subtract(30, 'minutes')
      .toDate();

    if (
      this.notified[symbol.exchange + symbol.symbol + strategyKey] &&
      signalWindow <= this.notified[symbol.exchange + symbol.symbol + strategyKey]
    ) {
      // console.log('blocked')
    } else {
      this.notified[symbol.exchange + symbol.symbol + strategyKey] = new Date();
      this.notifier.send(`[${signal} (${strategyKey})` + `] ${symbol.exchange}:${symbol.symbol} - ${ticker.ask}`);

      // log signal
      this.signalLogger.signal(
        symbol.exchange,
        symbol.symbol,
        {
          price: ticker.ask,
          strategy: strategyKey,
          raw: JSON.stringify(result)
        },
        signal,
        strategyKey
      );
    }
  }

  async visitTradeStrategy(strategy, symbol) {
    const ticker = this.tickers.get(symbol.exchange, symbol.symbol);

    if (!ticker) {
      console.error(`Ticker no found for + ${symbol.exchange}${symbol.symbol}`);
      return;
    }

    const strategyKey = strategy.strategy;

    let context = StrategyContext.create(ticker);
    const position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol);
    if (position) {
      context = StrategyContext.createFromPosition(ticker, position);
    }

    const result = await this.strategyManager.executeStrategy(
      strategyKey,
      context,
      symbol.exchange,
      symbol.symbol,
      strategy.options || {}
    );
    if (!result) {
      return;
    }

    const signal = result.getSignal();
    if (!signal || typeof signal === 'undefined') {
      return;
    }

    if (!['close', 'short', 'long'].includes(signal)) {
      throw `Invalid signal: ${JSON.stringify(signal, strategy)}`;
    }

    const signalWindow = moment()
      .subtract(_.get(symbol, 'trade.signal_slowdown_minutes', 15), 'minutes')
      .toDate();

    const noteKey = symbol.exchange + symbol.symbol;
    if (noteKey in this.notified && this.notified[noteKey] >= signalWindow) {
      return;
    }

    // log signal
    this.logger.info(
      [new Date().toISOString(), signal, strategyKey, symbol.exchange, symbol.symbol, ticker.ask].join(' ')
    );
    this.notifier.send(`[${signal} (${strategyKey})` + `] ${symbol.exchange}:${symbol.symbol} - ${ticker.ask}`);
    this.signalLogger.signal(
      symbol.exchange,
      symbol.symbol,
      {
        price: ticker.ask,
        strategy: strategyKey,
        raw: JSON.stringify(result)
      },
      signal,
      strategyKey
    );
    this.notified[noteKey] = new Date();

    await this.pairStateManager.update(symbol.exchange, symbol.symbol, signal);
  }

  async onTick() {
    const promises = [];

    const queue = new PQueue({ concurrency: this.systemUtil.getConfig('tick.pair_signal_concurrency', 10) });

    this.instances.symbols
      .filter(symbol => symbol.trade && symbol.trade.strategies && symbol.trade.strategies.length > 0)
      .forEach(symbol => {
        symbol.trade.strategies.forEach(strategy => {
          promises.push(async () => {
            await this.visitTradeStrategy(strategy, symbol);
          });
        });
      });

    this.instances.symbols
      .filter(symbol => symbol.strategies && symbol.strategies.length > 0)
      .forEach(symbol => {
        symbol.strategies.forEach(strategy => {
          promises.push(async () => {
            await this.visitStrategy(strategy, symbol);
          });
        });
      });

    await queue.addAll(promises);

    queue.clear();
  }
};
