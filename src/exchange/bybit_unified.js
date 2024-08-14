const moment = require('moment');
const ccxtpro = require('ccxt').pro;
const Ticker = require('../dict/ticker');
const TickerEvent = require('../event/ticker_event');
const ExchangeCandlestick = require('../dict/exchange_candlestick');
const Position = require('../dict/position');
const CommonUtil = require('../utils/common_util');
const ExchangeOrder = require('../dict/exchange_order');
const OrderBag = require('./utils/order_bag');
const Order = require('../dict/order');
const orderUtil = require('../utils/order_util');

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
    this.orderbag = new OrderBag();

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

    if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
      this.authInit(config.key, config.secret);
    } else {
      me.logger.info(`${this.getName()}: Starting as anonymous; no trading possible`);
    }

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

  authInit(apiKey, secret) {
    const exchange = new ccxtpro.bybit({
      apiKey: apiKey,
      secret: secret,
      newUpdates: true
    });

    this.exchangeAuth = exchange;
    const me = this;

    setTimeout(async () => {
      await this.updatePostionsViaRest(exchange);
      await this.updateOrderViaRest(exchange);
    }, 2000);

    setInterval(() => this.updatePostionsViaRest(exchange), 31700);
    setInterval(() => this.updateOrderViaRest(exchange), 32900);

    setTimeout(async () => {
      while (true) {
        try {
          const positions = await exchange.watchPositions();
          BybitUnified.createPositionsWithOpenStateOnly(positions).forEach(position => {
            me.positions[position.symbol] = position;
          });
        } catch (e) {
          console.error(`${this.getName()}: watchPositions error: ${e.message}`);
          this.logger.error(`${this.getName()}: watchPositions error: ${e.message}`);
        }
      }
    }, 1000);

    setTimeout(async () => {
      while (true) {
        try {
          const orders = await exchange.watchOrders();
          BybitUnified.createOrders(orders).forEach(o => me.orderbag.triggerOrder(o));
        } catch (e) {
          console.error(`${this.getName()}: watchOrders error: ${e.message}`);
          this.logger.error(`${this.getName()}: watchOrders error: ${e.message}`);
        }
      }
    }, 1000);
  }

  async updateOrderViaRest(exchange, me) {
    try {
      const orders = await exchange.fetchOpenOrders();
      this.orderbag.set(BybitUnified.createOrders(orders));
      this.logger.debug(`${this.getName()}: orders via API updated: ${Object.keys(this.positions).length}`);
    } catch (e) {
      console.log(`${this.getName()}: orders via API error: ${e.message}`);
      this.logger.error(`${this.getName()}: orders via API error: ${e.message}`);
    }
  }

  async updatePostionsViaRest(exchange) {
    try {
      const positions = await exchange.fetchPositions();

      const positionsFinal = {};
      BybitUnified.createPositionsWithOpenStateOnly(positions).forEach(position => {
        positionsFinal[position.symbol] = position;
      });

      this.positions = positionsFinal;
      this.logger.debug(`${this.getName()}: positions via API updated: ${Object.keys(this.positions).length}`);
    } catch (e) {
      console.log(`${this.getName()}: positions via API error: ${e.message}`);
      this.logger.error(`${this.getName()}: positions via API error: ${e.message}`);
    }
  }

  static createOrders(orders) {
    const myOrders = [];

    orders.forEach(order => {
      let status;
      switch (order.status) {
        case 'open':
          status = ExchangeOrder.STATUS_OPEN;
          break;
        case 'closed':
          status = ExchangeOrder.STATUS_DONE;
          break;
        case 'canceled':
          status = ExchangeOrder.STATUS_CANCELED;
          break;
        case 'rejected':
        case 'expired':
          status = ExchangeOrder.STATUS_REJECTED;
          break;
        default:
          console.error(`invalid order status: ${order.status}`);
          return;
      }

      let orderType;
      switch (order.type) {
        case 'limit':
          orderType = ExchangeOrder.TYPE_LIMIT;
          break;
        case 'market':
          orderType = ExchangeOrder.TYPE_MARKET;
          break;
        default:
          console.error(`invalid order type: ${order.type}`);
          return;
      }

      myOrders.push(
        new ExchangeOrder(
          order.id,
          order.symbol,
          order.status,
          order.price,
          order.qty,
          status === ExchangeOrder.STATUS_REJECTED,
          order.clientOrderId ? order.clientOrderId : undefined,
          order.side.toLowerCase() === 'buy' ? 'buy' : 'sell', // secure the value,
          orderType,
          new Date(isNaN(order.timestamp) ? order.timestamp : parseInt(order.timestamp)),
          new Date(),
          JSON.parse(JSON.stringify(order)),
          {
            post_only: order.postOnly || false,
            reduce_only: order.reduceOnly || false
          }
        )
      );
    });

    return myOrders;
  }

  static createPositionsWithOpenStateOnly(positions) {
    return positions
      .filter(position => ['short', 'long'].includes(position.side?.toLowerCase()))
      .map(position => {
        const side = position.side.toLowerCase();
        let size = position.contracts;

        if (side === 'short') {
          size *= -1;
        }

        return new Position(
          position.symbol,
          side,
          size,
          position.markPrice && position.entryPrice ? CommonUtil.getProfitAsPercent(side, position.markPrice, position.entryPrice) : undefined,
          new Date(),
          parseFloat(position.entryPrice),
          new Date(),
          position
        );
      });
  }

  getOrders() {
    return this.orderbag.getOrders();
  }

  findOrderById(id) {
    return this.orderbag.findOrderById(id);
  }

  getOrdersForSymbol(symbol) {
    return this.orderbag.getOrdersForSymbol(symbol);
  }

  async getPositions() {
    return Object.values(this.positions);
  }

  async getPositionForSymbol(symbol) {
    for (const position of await this.getPositions()) {
      if (position.symbol === symbol) {
        return position;
      }
    }

    return undefined;
  }

  /**
   * LTC: 0.008195 => 0.00820
   *
   * @param price
   * @param symbol
   * @returns {*}
   */
  calculatePrice(price, symbol) {
    if (!(symbol in this.tickSizes)) {
      return undefined;
    }

    return orderUtil.calculateNearestSize(price, this.tickSizes[symbol]);
  }

  /**
   * LTC: 0.65 => 1
   *
   * @param amount
   * @param symbol
   * @returns {*}
   */
  calculateAmount(amount, symbol) {
    if (!(symbol in this.lotSizes)) {
      return undefined;
    }

    return orderUtil.calculateNearestSize(amount, this.lotSizes[symbol]);
  }

  getName() {
    return 'bybit_unified';
  }

  async order(order) {
    let orderType;
    switch (order.getType()) {
      case Order.TYPE_LIMIT:
        orderType = 'limit';
        break;
      case Order.TYPE_MARKET:
        orderType = 'market';
        break;
      default:
        console.error(`${this.getName()}: invalid orderType: ${order.getType()}`);
        this.logger.error(`${this.getName()}: invalid orderType: ${order.getType()}`);
        return undefined;
    }

    const params = {
      postOnly: order.isPostOnly(),
      reduceOnly: order.isReduceOnly()
    };

    let placedOrder;
    try {
      placedOrder = await this.exchangeAuth.createOrder(
        order.getSymbol(),
        orderType,
        order.isLong() ? 'buy' : 'sell',
        order.getAmount(),
        order.getPrice(),
        params
      );
    } catch (e) {
      this.logger.error(`${this.getName()}: order place error: ${e.message} ${JSON.stringify(order)}`);
      return ExchangeOrder.createRejectedFromOrder(order, e.message);
    }

    // wait what we get
    await this.exchangeAuth.sleep(1000);
    const o = await this.exchangeAuth.fetchOpenOrder(placedOrder.id);
    return BybitUnified.createOrders([o])[0];
  }

  async cancelOrder(id) {
    const order = await this.findOrderById(id);
    try {
      await this.exchangeAuth.cancelOrder(id, order.getSymbol());
    } catch (e) {
      this.logger.error(`${this.getName()}: order cancel error: ${e.message} ${JSON.stringify(id)}`);
    }
  }

  async cancelAll(symbol) {
    try {
      await this.exchangeAuth.cancelAllOrders(symbol);
    } catch (e) {
      this.logger.error(`${this.getName()}: order cancel all error: ${e.message} ${JSON.stringify(symbol)}`);
    }
  }

  isInverseSymbol(symbol) {
    return false;
  }
};
