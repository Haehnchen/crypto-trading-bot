const BFX = require('bitfinex-api-node');

const { Order } = require('bfx-api-node-models');
const moment = require('moment');
const _ = require('lodash');
const ExchangeCandlestick = require('./../dict/exchange_candlestick');
const Ticker = require('./../dict/ticker');
const Position = require('../dict/position');

const TickerEvent = require('./../event/ticker_event.js');
const ExchangeOrder = require('../dict/exchange_order');
const OrderUtil = require('../utils/order_util');

module.exports = class Bitfinex {
  constructor(eventEmitter, logger, requestClient, candleImport) {
    this.eventEmitter = eventEmitter;
    this.candleImport = candleImport;
    this.logger = logger;
    this.positions = {};
    this.orders = [];
    this.requestClient = requestClient;
    this.exchangePairs = {};
    this.tickers = {};
  }

  start(config, symbols) {
    const subscriptions = [];

    symbols.forEach(instance => {
      // candles
      instance.periods.forEach(period => {
        let myPeriod = period;
        if (period === '1d') {
          myPeriod = period.toUpperCase();
        }

        subscriptions.push({
          type: 'subscribeCandles',
          parameter: `trade:${myPeriod}:t${instance.symbol}`
        });
      });

      // ticker
      subscriptions.push({
        type: 'subscribeTicker',
        parameter: `t${instance.symbol}`
      });
    });

    // split subscriptions into chunks; currently limit is 30 (reduce it on our side, also) based on Bitfinex api
    _.chunk(subscriptions, 25).forEach((chunk, index) => {
      // chunk connect, but wait for each chunk for possible connection limit
      setTimeout(async () => {
        this.openPublicWebsocketChunk(chunk, index + 1);
      }, 2250 * (index + 1));
    });

    const isAuthed = config.key && config.secret && config.key.length > 0 && config.secret.length > 0;

    if (!isAuthed) {
      this.logger.info('Bitfinex: Starting as anonymous; no trading possible');
    } else {
      const me = this;
      this.client = this.openAuthenticatedPublicWebsocket(config.key, config.secret);

      setInterval(
        (function f() {
          me.syncSymbolDetails();
          return f;
        })(),
        60 * 60 * 30 * 1000
      );
    }
  }

  getName() {
    return 'bitfinex';
  }

  /**
   * Position events from websocket: New, Update, Delete
   */
  onPositionUpdate(position) {
    if (position.status && position.status.toLowerCase() === 'closed') {
      delete this.positions[Bitfinex.formatSymbol(position.symbol)];
      return;
    }

    const myPositions = Bitfinex.createPositions([position]);

    if (myPositions.length > 0) {
      this.positions[myPositions[0].symbol] = myPositions[0];
    }
  }

  onPositions(positions) {
    const myPositions = {};

    Bitfinex.createPositions(positions).forEach(position => {
      myPositions[position.symbol] = position;
    });

    this.positions = myPositions;
  }

  /**
   * Order events from websocket: New, Update, Delete
   */
  onOrderUpdate(orderUpdate) {
    if (orderUpdate.type.toLowerCase().includes('exchange')) {
      return;
    }

    const order = Bitfinex.createExchangeOrder(orderUpdate);

    this.logger.info(`Bitfinex: order update: ${JSON.stringify(order)}`);
    this.orders[order.id] = order;
  }

  async order(order) {
    const result = await new Order(Bitfinex.createOrder(order)).submit(this.client);

    const executedOrder = Bitfinex.createExchangeOrder(result);
    this.triggerOrder(executedOrder);

    return executedOrder;
  }

  async updateOrder(id, order) {
    const amount = order.side === 'buy' ? order.amount : order.amount * -1;

    const changes = {
      id: id
    };

    if (order.amount) {
      changes.amount = String(amount);
    }

    if (order.price) {
      changes.price = String(Math.abs(order.price));
    }

    let result;
    try {
      result = await this.client.updateOrder(changes);
    } catch (e) {
      this.logger.error(`Bitfinex: error updating order: ${JSON.stringify([id, order])}`);
      throw e;
    }

    const unseralized = Order.unserialize(result);

    const executedOrder = Bitfinex.createExchangeOrder(unseralized);
    this.triggerOrder(executedOrder);

    return executedOrder;
  }

  async getOrders() {
    const orders = [];

    for (const key in this.orders) {
      if (this.orders[key].status === 'open') {
        orders.push(this.orders[key]);
      }
    }

    return orders;
  }

  async getOrdersForSymbol(symbol) {
    const orders = [];

    for (const key in this.orders) {
      const order = this.orders[key];

      if (order.status === 'open' && order.symbol === symbol) {
        orders.push(order);
      }
    }

    return orders;
  }

  /**
   * LTC: 0.008195 => 0.00820
   *
   * @param price
   * @param symbol
   * @returns {*}
   */
  calculatePrice(price, symbol) {
    const size =
      !(symbol in this.exchangePairs) || !this.exchangePairs[symbol].tick_size
        ? '0.001'
        : this.exchangePairs[symbol].tick_size;

    return OrderUtil.calculateNearestSize(price, size);
  }

  /**
   * LTC: 0.65 => 1
   *
   * @param amount
   * @param symbol
   * @returns {*}
   */
  calculateAmount(amount, symbol) {
    const size =
      !(symbol in this.exchangePairs) || !this.exchangePairs[symbol].lot_size
        ? '0.001'
        : this.exchangePairs[symbol].lot_size;

    return OrderUtil.calculateNearestSize(amount, size);
  }

  async getPositions() {
    const positions = [];

    for (const symbol in this.positions) {
      let position = this.positions[symbol];

      if (position.entry && this.tickers[position.symbol]) {
        if (position.side === 'long') {
          position = Position.createProfitUpdate(
            position,
            (this.tickers[position.symbol].bid / position.entry - 1) * 100
          );
        } else if (position.side === 'short') {
          position = Position.createProfitUpdate(
            position,
            (position.entry / this.tickers[position.symbol].ask - 1) * 100
          );
        }
      }

      positions.push(position);
    }

    return positions;
  }

  getPositionForSymbol(symbol) {
    return new Promise(resolve => {
      for (const key in this.positions) {
        const position = this.positions[key];

        if (position.symbol === symbol) {
          resolve(position);
          return;
        }
      }

      return resolve();
    });
  }

  async cancelOrder(id) {
    const order = await this.findOrderById(id);
    if (!order) {
      return undefined;
    }

    // external lib does not support string as id; must be int
    // is failing in a timeout
    if (typeof id === 'string' && id.match(/^\d+$/)) {
      id = parseInt(id);
    }

    let result;
    try {
      result = await this.client.cancelOrder(id);
    } catch (e) {
      this.logger.error(`Bitfinex: cancel order error: ${e}`);
      return undefined;
    }

    delete this.orders[id];

    return ExchangeOrder.createCanceled(order);
  }

  async findOrderById(id) {
    return (await this.getOrders()).find(order => order.id === id || order.id == id);
  }

  async cancelAll(symbol) {
    const orders = [];

    for (const order of await this.getOrdersForSymbol(symbol)) {
      orders.push(await this.cancelOrder(order.id));
    }

    return orders;
  }

  async syncSymbolDetails() {
    this.logger.debug('Bitfinex: Sync symbol details');

    const result = await this.requestClient.executeRequestRetry(
      {
        url: 'https://api.bitfinex.com/v1/symbols_details',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      },
      r => {
        return r.response && r.response.statusCode >= 500;
      }
    );

    const exchangePairs = {};

    JSON.parse(result.body)
      .filter(product => product.margin === true)
      .forEach(product => {
        const minSize = parseFloat(product.minimum_order_size);
        let prec = 0;

        if (minSize > 130) {
          prec = 4;
        } else if (minSize > 30) {
          prec = 3;
        } else if (minSize > 1) {
          prec = 2;
        } else if (minSize > 0.1) {
          prec = 1;
        }

        const increment = `0.${'0'.repeat(
          prec + product.price_precision - (product.pair.substring(3, 6).toUpperCase() === 'USD' ? 3 : 0)
        )}1`;

        exchangePairs[product.pair.substring(0, 3).toUpperCase()] = {
          lot_size: increment,
          tick_size: increment
        };
      });

    this.exchangePairs = exchangePairs;
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

  static createExchangeOrder(order) {
    let status;
    let retry = false;

    if (order.status === 'ACTIVE' || order.status.match(/^PARTIALLY FILLED/)) {
      status = 'open';
    } else if (order.status.match(/^EXECUTED/)) {
      status = 'done';
    } else if (order.status === 'CANCELED') {
      status = 'rejected';
    } else if (order.status === 'POSTONLY CANCELED') {
      status = 'rejected';
      retry = true;
      // order.reject_reason = 'post only'
    }

    const bitfinex_id = order.id;
    const created_at = order.status;
    // let filled_size = n(position[7]).subtract(ws_order[6]).format('0.00000000')
    const bitfinex_status = order.status;
    const { price } = order;
    const { price_avg } = order;

    let orderType;
    switch (order.type.toLowerCase().replace(/[\W_]+/g, '')) {
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
      case 'trailingstop':
        orderType = ExchangeOrder.TYPE_TRAILING_STOP;
        break;
      default:
        orderType = ExchangeOrder.TYPE_UNKNOWN;
        break;
    }

    const orderValues = {};
    if (order._fieldKeys) {
      order._fieldKeys.map(k => {
        orderValues[k] = order[k];
      });
    }

    return new ExchangeOrder(
      bitfinex_id,
      Bitfinex.formatSymbol(order.symbol),
      status,
      price,
      order.amount,
      retry,
      order.cid,
      order.amount < 0 ? 'sell' : 'buy',
      orderType,
      new Date(order.mtsUpdate),
      new Date(),
      orderValues
    );
  }

  static createExchangeOrders(orders) {
    return orders.map(Bitfinex.createExchangeOrder);
  }

  static createOrder(order) {
    const amount = Math.abs(order.amount);

    const orderOptions = {
      cid: order.id,
      symbol: `t${order.symbol}`,
      amount: order.price < 0 ? amount * -1 : amount,
      meta: { aff_code: 'kDLceRHa' }
    };

    if (!order.type || order.type === 'limit') {
      orderOptions.type = Order.type.LIMIT;
      orderOptions.price = String(Math.abs(order.price));
    } else if (order.type === 'stop') {
      orderOptions.type = Order.type.STOP;
      orderOptions.price = String(Math.abs(order.price));
    } else if (order.type === 'market') {
      orderOptions.type = Order.type.MARKET;
    } else if (order.type === 'trailing_stop') {
      orderOptions.type = Order.type.TRAILING_STOP;
      orderOptions.price = String(Math.abs(order.price));
    }

    const myOrder = new Order(orderOptions);

    if (order.options && order.options.post_only === true) {
      myOrder.setPostOnly(true);
    }

    if (order.options && order.options.close === true && orderOptions.type && orderOptions.type === Order.type.STOP) {
      myOrder.setReduceOnly(true);
    }

    return myOrder;
  }

  static createPositions(positions) {
    return positions
      .filter(position => {
        return position.status.toLowerCase() === 'active';
      })
      .map(position => {
        return new Position(
          Bitfinex.formatSymbol(position.symbol),
          position.amount < 0 ? 'short' : 'long',
          position.amount,
          undefined,
          new Date(),
          position.basePrice,
          new Date()
        );
      });
  }

  static formatSymbol(symbol) {
    return symbol.substring(0, 1) === 't' ? symbol.substring(1) : symbol;
  }

  isInverseSymbol(symbol) {
    return false;
  }

  /**
   * Connect to websocket on chunks because Bitfinex limits per connection subscriptions eg to 30
   *
   * @param subscriptions
   * @param index current chunk
   */
  openPublicWebsocketChunk(subscriptions, index) {
    const me = this;

    me.logger.debug(`Bitfinex: public websocket ${index} chunks connecting: ${JSON.stringify(subscriptions)}`);

    const ws = new BFX({
      version: 2,
      transform: true,
      autoOpen: true
    }).ws();

    ws.on('error', err => {
      me.logger.error(`Bitfinex: public websocket ${index} error: ${JSON.stringify([err.message, err])}`);
    });

    ws.on('close', () => {
      me.logger.error(`Bitfinex: public websocket ${index} Connection closed; reconnecting soon`);

      // retry connecting after some second to not bothering on high load
      setTimeout(() => {
        me.logger.info(`Bitfinex: public websocket ${index} Connection reconnect`);
        ws.open();
      }, 10000);
    });

    ws.on('open', () => {
      me.logger.info(
        `Bitfinex: public websocket ${index} connection open. Subscription to ${subscriptions.length} channels`
      );

      subscriptions.forEach(subscription => {
        ws[subscription.type](subscription.parameter);
      });
    });

    ws.on('ticker', (pair, ticker) => {
      const symbol = Bitfinex.formatSymbol(pair);

      me.eventEmitter.emit(
        'ticker',
        new TickerEvent(
          'bitfinex',
          symbol,
          (me.tickers[symbol] = new Ticker('bitfinex', symbol, moment().format('X'), ticker.bid, ticker.ask))
        )
      );
    });

    ws.on('candle', async (candles, pair) => {
      const options = pair.split(':');

      if (options.length < 3) {
        return;
      }

      const period = options[1].toLowerCase();
      let mySymbol = options[2];

      if (mySymbol.substring(0, 1) === 't') {
        mySymbol = mySymbol.substring(1);
      }

      const myCandles = [];

      if (Array.isArray(candles)) {
        candles.forEach(function(candle) {
          myCandles.push(candle);
        });
      } else {
        myCandles.push(candles);
      }

      const sticks = myCandles
        .filter(function(candle) {
          return typeof candle.mts !== 'undefined';
        })
        .map(function(candle) {
          return new ExchangeCandlestick(
            'bitfinex',
            mySymbol,
            period.toLowerCase(),
            Math.round(candle.mts / 1000),
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume
          );
        });

      if (sticks.length === 0) {
        return;
      }

      await this.candleImport.insertThrottledCandles(sticks);
    });

    ws.open();
  }

  /**
   * Create a websocket just for authenticated requests a written is official Bitfinex documentation
   *
   * @param apiKey
   * @param apiSecret
   * @returns {WSv1|WSv2}
   */
  openAuthenticatedPublicWebsocket(apiKey, apiSecret) {
    const ws = new BFX({
      version: 2,
      transform: true,
      autoOpen: true,
      apiKey: apiKey,
      apiSecret: apiSecret
    }).ws();

    const me = this;

    this.logger.info('Bitfinex: Authenticated Websocket connecting');

    ws.on('error', err => {
      me.logger.error(`Bitfinex: Authenticated Websocket error: ${JSON.stringify([err.message, err])}`);
    });

    ws.on('close', () => {
      me.logger.error('Bitfinex: Authenticated Websocket Connection closed; reconnecting soon');

      // retry connecting after some second to not bothering on high load
      setTimeout(() => {
        me.logger.info('Bitfinex: Authenticated Websocket Connection reconnect');
        ws.open();
      }, 10000);
    });

    ws.on('open', () => {
      me.logger.debug('Bitfinex: Authenticated Websocket Connection open');

      // authenticate
      ws.auth();
    });

    ws.onOrderUpdate({}, order => {
      me.onOrderUpdate(order);
    });

    ws.onOrderNew({}, order => {
      me.onOrderUpdate(order);
    });

    ws.onOrderClose({}, order => {
      me.onOrderUpdate(order);
    });

    ws.onOrderSnapshot({}, orders => {
      const marginOrder = orders.filter(order => !order.type.toLowerCase().includes('exchange'));

      Bitfinex.createExchangeOrders(marginOrder).forEach(order => {
        me.orders[order.id] = order;
      });
    });

    ws.onPositionSnapshot({}, positions => {
      me.onPositions(positions);
    });

    ws.onPositionUpdate({}, position => {
      me.onPositionUpdate(position);
    });

    ws.onPositionNew({}, position => {
      me.onPositionUpdate(position);
    });

    ws.onPositionClose({}, position => {
      me.onPositionUpdate(position);
    });

    ws.open();

    return ws;
  }
};
