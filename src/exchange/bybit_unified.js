const moment = require('moment');
const ccxtpro = require('ccxt').pro;
const Ticker = require('../dict/ticker');
const TickerEvent = require('../event/ticker_event');
const ExchangeCandlestick = require('../dict/exchange_candlestick');

module.exports = class BybitUnified {
  constructor(eventEmitter, requestClient, candlestickResample, logger, queue, candleImporter, throttler) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.queue = queue;
    this.candleImporter = candleImporter;

    this.apiKey = undefined;
    this.apiSecret = undefined;
    this.tickSizes = {};
    this.lotSizes = {};

    this.positions = {};
    this.orders = {};
    this.tickers = {};
    this.symbols = [];
    this.intervals = [];
  }

  async start(config, symbols) {
    const { eventEmitter } = this;
    const { logger } = this;
    const { tickSizes } = this;
    const { lotSizes } = this;
    this.intervals = [];
    const me = this;

    this.symbols = symbols;
    this.positions = {};
    this.orders = {};

    const exchange = new ccxtpro.bybit({ newUpdates: false });

    setTimeout(async () => {
      const result = (await exchange.fetch_markets()).filter(i => i.type === 'swap' && i.quote === 'USDT');
      result.forEach(instrument => {
        tickSizes[instrument.symbol] = parseFloat(instrument.precision.price);
        lotSizes[instrument.symbol] = parseFloat(instrument.precision.amount);
      });
    }, 5000);

    setTimeout(async () => {
      const symbolPeriods = [];
      symbols.forEach(symbol => {
        symbolPeriods.push(...symbol.periods.map(p => [symbol.symbol, p]));
      });

      while (true) {
        try {
          const event = await exchange.watchOHLCVForSymbols(symbolPeriods);

          const cxchangeCandlesticks = [];

          for (const [symbol, tickers] of Object.entries(event)) {
            for (const [period, candles] of Object.entries(tickers)) {
              // timestamp, open, high, low, close, volume
              cxchangeCandlesticks.push(
                ...candles.map(t => new ExchangeCandlestick(me.getName(), symbol, period, Math.round(t[0] / 1000), t[1], t[2], t[3], t[4], t[5]))
              );
            }
          }

          me.candleImporter.insertThrottledCandles(cxchangeCandlesticks);
        } catch (e) {
          logger.error('watchOHLCVForSymbols error', e);
        }
      }
    }, 1000);

    const symboleIds = symbols.map(symbol => symbol.symbol);

    setTimeout(async () => {
      while (true) {
        try {
          const event = await exchange.watchTickers(symboleIds);

          for (const [symbol, ticker] of Object.entries(event)) {
            const tickerEvent = new TickerEvent(
              me.getName(),
              symbol,
              (me.tickers[symbol] = new Ticker(me.getName(), symbol, moment().format('X'), ticker.bid, ticker.ask))
            );
            eventEmitter.emit('ticker', tickerEvent);
          }
        } catch (e) {
          logger.error('watchTickers error', e);
        }
      }
    }, 1000);

    // const tickers = await exchange.watchTickers(['BTC/USDT:USDT']);
    // console.log(tickers);

    /**
     *       if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
     *         me.logger.info('BybitLinear: sending auth request');
     *         me.apiKey = config.key;
     *         me.apiSecret = config.secret;
     *       } else {
     *         me.logger.info('BybitLinear: Starting as anonymous; no trading possible');
     *       }
     */

    symbols.forEach(symbol => {
      symbol.periods.forEach(period => {
        // for bot init prefill data: load latest candles from api
        this.queue.add(async () => {
          let candles;
          try {
            candles = await exchange.fetchOHLCV(symbol.symbol, period, undefined, 500);
          } catch (e) {
            logger.error('backfill error bybit', symbol.symbol, period, e);
            return;
          }

          const candleSticks = candles.map(
            t => new ExchangeCandlestick(me.getName(), symbol.symbol, period, Math.round(t[0] / 1000), t[1], t[2], t[3], t[4], t[5])
          );

          await this.candleImporter.insertThrottledCandles(candleSticks);
        });
      });
    });
  }

  async getOrders() {
    return [];
  }

  async findOrderById(id) {
    return null;
  }

  async getOrdersForSymbol(symbol) {
    return null;
  }

  async getPositions() {
    return [];
  }

  async getPositionForSymbol(symbol) {
    return null;
  }

  /**
   * LTC: 0.008195 => 0.00820
   *
   * @param price
   * @param symbol
   * @returns {*}
   */
  calculatePrice(price, symbol) {
    throw Error('not supported');
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order) {
    throw Error('not supported');
  }

  /**
   * LTC: 0.65 => 1
   *
   * @param amount
   * @param symbol
   * @returns {*}
   */
  calculateAmount(amount, symbol) {
    throw Error('not supported');
  }

  getName() {
    return 'bybit_unified';
  }

  async order(order) {
    throw Error('not supported');
  }

  async cancelOrder(id) {
    throw Error('not supported');
  }

  async cancelAll(symbol) {
    throw Error('not supported');
  }
};
