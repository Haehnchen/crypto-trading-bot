const Gdax = require('coinbase-pro');

const moment = require('moment');
const ExchangeCandlestick = require('../dict/exchange_candlestick');
const Ticker = require('../dict/ticker');
const TickerEvent = require('../event/ticker_event');
const OrderUtil = require('../utils/order_util');
const Resample = require('../utils/resample');
const CandlesFromTrades = require('./utils/candles_from_trades');
const ExchangeOrder = require('../dict/exchange_order');
const Position = require('../dict/position');
const Order = require('../dict/order');

module.exports = class CoinbasePro {
  constructor(eventEmitter, logger, candlestickResample, queue, candleImporter) {
    this.eventEmitter = eventEmitter;
    this.queue = queue;
    this.logger = logger;
    this.candlestickResample = candlestickResample;
    this.candleImporter = candleImporter;

    this.client = undefined;

    this.orders = {};
    this.exchangePairs = {};
    this.symbols = {};
    this.tickers = {};
    this.fills = {};
    this.balances = [];

    this.intervals = [];

    this.candlesFromTrades = new CandlesFromTrades(candlestickResample, candleImporter);
  }

  start(config, symbols) {
    this.symbols = symbols;
    this.candles = {};
    this.orders = {};
    this.exchangePairs = {};
    this.lastCandleMap = {};
    this.tickers = {};
    this.fills = {};
    this.balances = [];
    this.intervals = [];

    const { eventEmitter } = this;

    let wsAuth = {};

    const channels = ['ticker', 'matches'];

    let isAuth = false;

    if (
      config.key &&
      config.secret &&
      config.passphrase &&
      config.key.length > 0 &&
      config.secret.length > 0 &&
      config.passphrase.length > 0
    ) {
      isAuth = true;
      // for user related websocket actions
      channels.push('user');

      this.client = this.client = new Gdax.AuthenticatedClient(config.key, config.secret, config.passphrase);

      wsAuth = {
        key: config.key,
        secret: config.secret,
        passphrase: config.passphrase
      };

      this.logger.info('Coinbase Pro: Using AuthenticatedClient');
    } else {
      this.client = new Gdax.PublicClient();
      this.logger.info('Coinbase Pro: Using PublicClient');
    }

    const websocket = new Gdax.WebsocketClient(
      symbols.map(s => s.symbol),
      undefined,
      wsAuth,
      { channels: channels }
    );

    symbols.forEach(symbol => {
      symbol.periods.forEach(interval =>
        this.queue.add(async () => {
          // backfill
          const granularity = Resample.convertPeriodToMinute(interval) * 60;

          let candles;
          try {
            candles = await this.client.getProductHistoricRates(symbol.symbol, { granularity: granularity });
          } catch (e) {
            me.logger.error(
              `Coinbase Pro: candles fetch error: ${JSON.stringify([symbol.symbol, interval, String(e)])}`
            );
            return;
          }

          const ourCandles = candles.map(
            candle =>
              new ExchangeCandlestick(
                this.getName(),
                symbol.symbol,
                interval,
                candle[0],
                candle[3],
                candle[2],
                candle[1],
                candle[4],
                candle[5]
              )
          );

          await this.candleImporter.insertThrottledCandles(ourCandles);
        })
      );
    });

    let me = this;

    // let websocket bootup
    setTimeout(() => {
      this.intervals.push(
        setInterval(
          (function f() {
            me.syncPairInfo();
            return f;
          })(),
          60 * 60 * 15 * 1000
        )
      );

      // user endpoints
      if (isAuth) {
        this.intervals.push(
          setInterval(
            (function f() {
              me.syncOrders();
              return f;
            })(),
            1000 * 29
          )
        );

        this.intervals.push(
          setInterval(
            (function f() {
              me.syncFills();
              return f;
            })(),
            1000 * 31
          )
        );

        this.intervals.push(
          setInterval(
            (function f() {
              me.syncBalances();
              return f;
            })(),
            1000 * 32
          )
        );
      }
    }, 5000);

    websocket.on('message', async data => {
      if (data.type && data.type === 'ticker') {
        const ticker = (this.tickers[data.product_id] = new Ticker(
          this.getName(),
          data.product_id,
          moment().format('X'),
          data.best_bid,
          data.best_ask
        ));

        eventEmitter.emit('ticker', new TickerEvent(this.getName(), data.product_id, ticker));
      }

      // order events trigger reload of all open orders
      // "match" is also used in public endpoint, but only our order are holding user information
      if (data.type && data.type.includes('open', 'done', 'match') && data.user_id) {
        /*
                    { type: 'open',
                      side: 'sell',
                      price: '3.93000000',
                      order_id: '7ebcd292-78d5-4ec3-9b81-f58754aba806',
                      remaining_size: '1.00000000',
                      product_id: 'ETC-EUR',
                      sequence: 42219912,
                      user_id: '5a2ae60e76531100d3af2ee5',
                      profile_id: 'e6dd97c2-f4e8-4e9a-b44e-7f6594e330bd',
                      time: '2019-01-20T19:24:33.609000Z'
                    }
                 */

        await this.syncOrders();
      }

      // "match" order = filled: reload balances for our positions
      // "match" is also used in public endpoint, but only our order are holding user information
      if (data.type && data.type === 'match' && data.user_id) {
        await Promise.all([this.syncOrders(), this.syncFills(data.product_id)]);
      }

      // we ignore "last_match". its not in our range
      if (data.type && ['match'].includes(data.type)) {
        await me.onTrade(data, symbols);
      }
    });

    websocket.on('error', err => {
      this.logger.error(`Coinbase Pro: Error ${JSON.stringify(err)}`);
    });

    websocket.on('close', () => {
      this.logger.error('Coinbase Pro: closed');

      for (const interval of this.intervals) {
        clearInterval(interval);
      }

      this.intervals = [];

      // reconnect after close, after some waiting time
      setTimeout(() => {
        this.logger.info('Coinbase Pro: reconnect');

        me.start(config, symbols);
      }, 1000 * 30);
    });
  }

  /**
   * Coinbase does not deliver candles via websocket, so we fake them on the public order history (websocket)
   *
   * @param msg array
   * @param symbols
   */
  async onTrade(msg, symbols) {
    if (!msg.price || !msg.size || !msg.product_id) {
      return;
    }

    const trade = {
      timestamp: new Date(msg.time).getTime(),
      price: parseFloat(msg.price),
      amount: parseFloat(msg.size),
      symbol: msg.product_id
    };

    return this.candlesFromTrades.onTrade(this.getName(), trade, symbols);
  }

  getOrders() {
    return new Promise(resolve => {
      const orders = [];

      for (const key in this.orders) {
        if (this.orders[key].status === 'open') {
          orders.push(this.orders[key]);
        }
      }

      resolve(orders);
    });
  }

  findOrderById(id) {
    return new Promise(async resolve => {
      resolve((await this.getOrders()).find(order => order.id === id || order.id == id));
    });
  }

  getOrdersForSymbol(symbol) {
    return new Promise(async resolve => {
      resolve((await this.getOrders()).filter(order => order.symbol === symbol));
    });
  }

  /**
   * LTC: 0.008195 => 0.00820
   *
   * @param price
   * @param symbol
   * @returns {*}
   */
  calculatePrice(price, symbol) {
    if (!(symbol in this.exchangePairs) || !this.exchangePairs[symbol].tick_size) {
      return undefined;
    }

    return OrderUtil.calculateNearestSize(price, this.exchangePairs[symbol].tick_size);
  }

  /**
   * LTC: 0.65 => 1
   *
   * @param amount
   * @param symbol
   * @returns {*}
   */
  calculateAmount(amount, symbol) {
    if (!(symbol in this.exchangePairs) || !this.exchangePairs[symbol].lot_size) {
      return undefined;
    }

    return OrderUtil.calculateNearestSize(amount, this.exchangePairs[symbol].lot_size);
  }

  async getPositions() {
    const capitals = {};
    this.symbols
      .filter(
        s =>
          s.trade &&
          ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0))
      )
      .forEach(s => {
        if (s.trade.capital > 0) {
          capitals[s.symbol] = s.trade.capital;
        } else if (s.trade.currency_capital > 0 && this.tickers[s.symbol] && this.tickers[s.symbol].bid) {
          capitals[s.symbol] = s.trade.currency_capital / this.tickers[s.symbol].bid;
        }
      });

    const positions = [];
    for (const balance of this.balances) {
      const asset = balance.currency;

      for (const pair in capitals) {
        if (!pair.startsWith(asset)) {
          continue;
        }

        const capital = capitals[pair];
        const balanceUsed = parseFloat(balance.balance);

        // 1% balance left indicate open position
        if (Math.abs(balanceUsed / capital) <= 0.1) {
          continue;
        }

        // coin dust: which is smaller then the allowed order size should not be shown
        const exchangePairInfo = this.exchangePairs[pair];
        if (exchangePairInfo && exchangePairInfo.lot_size && balanceUsed < exchangePairInfo.lot_size) {
          continue;
        }

        let entry;
        let createdAt = new Date();
        let profit;

        // try to find a entry price, based on trade history
        if (this.fills[pair] && this.fills[pair][0]) {
          const result = CoinbasePro.calculateEntryOnFills(this.fills[pair]);
          if (result) {
            createdAt = new Date(result.created_at);
            entry = result.average_price;

            // calculate profit based on the ticket price
            if (this.tickers[pair] && this.tickers[pair].bid) {
              profit = (this.tickers[pair].bid / result.average_price - 1) * 100;
            }
          }
        }

        positions.push(new Position(pair, 'long', balanceUsed, profit, new Date(), entry, createdAt));
      }
    }

    return positions;
  }

  static calculateEntryOnFills(fills, balance) {
    const result = {
      size: 0,
      costs: 0
    };

    for (const fill of fills) {
      // stop if last fill is a sell
      if (fill.side !== 'buy') {
        break;
      }

      // stop if price out of range window
      const number = result.size + parseFloat(fill.size);
      if (number > balance * 1.15) {
        break;
      }

      // stop on old fills
      if (result.created_at) {
        const secDiff = Math.abs(new Date(fill.created_at).getTime() - new Date(result.created_at).getTime());

        // out of 7 day range
        if (secDiff > 60 * 60 * 24 * 7 * 1000) {
          break;
        }
      }

      result.size += parseFloat(fill.size);
      result.costs += parseFloat(fill.size) * parseFloat(fill.price) + parseFloat(fill.fee);

      result.created_at = fill.created_at;
    }

    result.average_price = result.costs / result.size;

    if (result.size === 0 || result.costs === 0) {
      return undefined;
    }

    return result;
  }

  async getPositionForSymbol(symbol) {
    return (await this.getPositions()).find(position => {
      return position.symbol === symbol;
    });
  }

  async syncOrders() {
    let ordersRaw = [];

    try {
      ordersRaw = await this.client.getOrders({ status: 'open' });
    } catch (e) {
      this.logger.error(`Coinbase Pro: orders ${String(e)}`);
      return;
    }

    const orders = {};
    CoinbasePro.createOrders(...ordersRaw).forEach(o => {
      orders[o.id] = o;
    });

    this.orders = orders;
  }

  async syncBalances() {
    let accounts;
    try {
      accounts = await this.client.getAccounts();
    } catch (e) {
      this.logger.error(`Coinbase Pro: balances ${String(e)}`);
      return;
    }

    if (!accounts) {
      return;
    }

    this.balances = accounts.filter(b => parseFloat(b.balance) > 0);
    this.logger.debug(`Coinbase Pro: Sync balances ${this.balances.length}`);
  }

  async syncFills(productId = undefined) {
    let symbols = [];

    if (productId) {
      symbols.push(productId);
    } else {
      symbols = this.symbols
        .filter(
          s =>
            s.trade &&
            ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0))
        )
        .map(x => {
          return x.symbol;
        });
    }

    this.logger.debug(`Coinbase Pro: Syncing fills: ${JSON.stringify([symbols])}`);

    for (const symbol of symbols) {
      try {
        this.fills[symbol] = (await this.client.getFills({ product_id: symbol })).slice(0, 15);
      } catch (e) {
        this.logger.error(`Coinbase Pro: fill sync error:${JSON.stringify([symbol, e.message])}`);
      }
    }
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order) {
    if (!(order instanceof ExchangeOrder)) {
      throw 'Invalid order given';
    }

    // dont overwrite state closed order
    if (order.id in this.orders && ['done', 'canceled'].includes(this.orders[order.id].status)) {
      delete this.orders[order.id];
      return;
    }

    this.orders[order.id] = order;
  }

  async order(order) {
    const payload = CoinbasePro.createOrderBody(order);
    let result;

    try {
      result = await this.client.placeOrder(payload);
    } catch (e) {
      this.logger.error(`Coinbase Pro: order create error: ${JSON.stringify([e.message, order, payload])}`);

      if (
        e.message &&
        (e.message.match(/HTTP\s4\d{2}/i) ||
          e.message.toLowerCase().includes('size is too accurate') ||
          e.message.toLowerCase().includes('size is too small'))
      ) {
        return ExchangeOrder.createRejectedFromOrder(order, e.message);
      }

      return;
    }

    const exchangeOrder = CoinbasePro.createOrders(result)[0];

    this.triggerOrder(exchangeOrder);
    return exchangeOrder;
  }

  async cancelOrder(id) {
    let orderId;

    try {
      orderId = await this.client.cancelOrder(id);
    } catch (e) {
      this.logger.error(`Coinbase Pro: cancel order error: ${e}`);
      return;
    }

    delete this.orders[orderId];
  }

  async cancelAll(symbol) {
    let orderIds;
    try {
      orderIds = await this.client.cancelAllOrders({ product_id: symbol });
    } catch (e) {
      this.logger.error(`Coinbase Pro: cancel all order error: ${String(e)}`);
      return;
    }

    for (const id of orderIds) {
      delete this.orders[id];
    }
  }

  static createOrderBody(order) {
    if (!order.getAmount() && !order.getPrice() && !order.getSymbol()) {
      throw 'Invalid amount for update';
    }

    const myOrder = {
      side: order.isShort() ? 'sell' : 'buy',
      price: order.getPrice(),
      size: order.getAmount(),
      product_id: order.getSymbol()
    };

    let orderType;
    const originOrderType = order.getType();
    if (!originOrderType || originOrderType === 'limit') {
      orderType = 'limit';
    } else if (originOrderType === 'stop') {
      orderType = 'stop';
    } else if (originOrderType === 'market') {
      orderType = 'market';
    }

    if (!orderType) {
      throw 'Invalid order type';
    }

    myOrder.type = orderType;

    if (order.isPostOnly()) {
      myOrder.post_only = true;
    }

    return myOrder;
  }

  static createOrders(...orders) {
    return orders.map(order => {
      let retry = false;

      let status;
      const orderStatus = order.status.toLowerCase();

      if (['open', 'active', 'pending'].includes(orderStatus)) {
        status = 'open';
      } else if (orderStatus === 'filled') {
        status = 'done';
      } else if (orderStatus === 'canceled') {
        status = 'canceled';
      } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
        status = 'rejected';
        retry = true;
      }

      const ordType = order.type.toLowerCase().replace(/[\W_]+/g, '');

      // secure the value
      let orderType;
      switch (ordType) {
        case 'limit':
          orderType = ExchangeOrder.TYPE_LIMIT;
          break;
        case 'stop':
          orderType = ExchangeOrder.TYPE_STOP;
          break;
        case 'market':
          orderType = ExchangeOrder.TYPE_MARKET;
          break;
        case 'stoplimit':
          orderType = ExchangeOrder.TYPE_STOP_LIMIT;
          break;
        default:
          orderType = ExchangeOrder.TYPE_UNKNOWN;
          break;
      }

      return new ExchangeOrder(
        order.id,
        order.product_id,
        status,
        parseFloat(order.price),
        parseFloat(order.size),
        retry,
        undefined,
        order.side.toLowerCase() === 'buy' ? 'buy' : 'sell', // secure the value,
        orderType,
        new Date(order.created_at),
        new Date(),
        order
      );
    });
  }

  async updateOrder(id, order) {
    if (!order.amount && !order.price) {
      throw 'Invalid amount / price for update';
    }

    const currentOrder = await this.findOrderById(id);
    if (!currentOrder) {
      return;
    }

    // cancel order; mostly it can already be canceled
    await this.cancelOrder(id);

    return await this.order(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount));
  }

  async syncPairInfo() {
    let pairs;
    try {
      pairs = await this.client.getProducts();
    } catch (e) {
      this.logger.error(`Coinbase Pro: pair sync error: ${e}`);

      return;
    }

    const exchangePairs = {};
    pairs.forEach(pair => {
      exchangePairs[pair.id] = {
        tick_size: parseFloat(pair.quote_increment),
        lot_size: parseFloat(pair.base_min_size)
      };
    });

    this.logger.info(`Coinbase Pro: pairs synced: ${pairs.length}`);
    this.exchangePairs = exchangePairs;
  }

  getName() {
    return 'coinbase_pro';
  }

  isInverseSymbol(symbol) {
    return false;
  }
};
