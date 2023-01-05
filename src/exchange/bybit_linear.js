const WebSocket = require('ws');
const moment = require('moment');
const request = require('request');
const _ = require('lodash');
const { LinearClient, WebsocketClient, ContractClient } = require('bybit-api');
const Ticker = require('../dict/ticker');
const TickerEvent = require('../event/ticker_event');
const Order = require('../dict/order');
const ExchangeCandlestick = require('../dict/exchange_candlestick');

const resample = require('../utils/resample');
const CommonUtil = require('../utils/common_util');
const Bybit = require('./bybit');
const ExchangeOrder = require('../dict/exchange_order');

const orderUtil = require('../utils/order_util');

module.exports = class BybitLinear {
  constructor(eventEmitter, requestClient, candlestickResample, logger, queue, candleImporter, throttler) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.queue = queue;
    this.candleImporter = candleImporter;
    this.requestClient = requestClient;
    this.throttler = throttler;

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

  start(config, symbols) {
    const { eventEmitter } = this;
    const { logger } = this;
    const { tickSizes } = this;
    const { lotSizes } = this;
    this.intervals = [];

    this.symbols = symbols;
    this.positions = {};
    this.orders = {};
    this.leverageUpdated = {};

    this.requestClient
      .executeRequestRetry(
        {
          url: `${this.getBaseUrl()}/v2/public/symbols`
        },
        result => result && result.response && result.response.statusCode >= 500
      )
      .then(response => {
        const body = JSON.parse(response.body);
        if (!body.result) {
          this.logger.error(`BybitLinear: invalid instruments request: ${response.body}`);
          return;
        }

        body.result.forEach(instrument => {
          tickSizes[instrument.name] = parseFloat(instrument.price_filter.tick_size);
          lotSizes[instrument.name] = parseFloat(instrument.lot_size_filter.qty_step);
        });
      });

    const ws = new WebSocket('wss://stream.bybit.com/realtime_public');

    const me = this;
    ws.onopen = function () {
      me.logger.info('BybitLinear: Connection opened.');

      symbols.forEach(symbol => {
        symbol.periods.forEach(p => {
          const periodMinute = resample.convertPeriodToMinute(p);

          ws.send(JSON.stringify({ op: 'subscribe', args: [`candle.${periodMinute}.${symbol.symbol}`] }));
        });

        ws.send(JSON.stringify({ op: 'subscribe', args: [`instrument_info.100ms.${symbol.symbol}`] }));
      });

      if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
        me.logger.info('BybitLinear: sending auth request');
        me.apiKey = config.key;
        me.apiSecret = config.secret;

        me.openAuthWebsocket(symbols);

        // load full order and positions in intervals; in case websocket is out opf sync
        me.syncPositionViaRestApi.bind(me);

        setTimeout(() => {
          me.intervals.push(
            setInterval(
              (function f() {
                me.throttler.addTask(
                  `bybit_linear_sync_all_orders`,
                  async () => {
                    await me.syncOrdersViaRestApi(symbols.map(symbol => symbol.symbol));
                  },
                  1245
                );

                me.throttler.addTask(`bybit_linear_sync_positions`, me.syncPositionViaRestApi.bind(me), 1245);
                return f;
              })(),
              60000
            )
          );
        }, 5000);
      } else {
        me.logger.info('BybitLinear: Starting as anonymous; no trading possible');
      }
    };

    ws.onmessage = async function (event) {
      if (event.type === 'message') {
        const data = JSON.parse(event.data);

        if ('success' in data && data.success === false) {
          me.logger.error(`BybitLinear: error ${event.data}`);
          console.log(`BybitLinear: error ${event.data}`);
        } else if (data.topic && data.topic.startsWith('candle.')) {
          const [topicName, period, symbol] = data.topic.split('.');

          const candles = data.data.map(
            candle =>
              new ExchangeCandlestick(
                me.getName(),
                symbol,
                resample.convertMinuteToPeriod(period),
                candle.start,
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume
              )
          );

          await me.candleImporter.insertThrottledCandles(candles);
        } else if (data.data && data.topic && data.topic.startsWith('instrument_info.')) {
          let instruments = [];
          if (data.data.update) {
            instruments = data.data.update;
          } else if (data.data.last_price) {
            instruments = [data.data];
          }

          instruments.forEach(instrument => {
            // update and init
            if (!instrument.last_price) {
              return;
            }

            const price = instrument.last_price;

            let bid = parseFloat(price);
            let ask = parseFloat(price);

            const { symbol } = instrument;

            // add price spread around the last price; as we not getting the bid and ask of the orderbook directly
            // prevent also floating issues
            if (symbol in me.tickSizes) {
              bid = parseFloat(orderUtil.calculateNearestSize(bid - me.tickSizes[symbol], me.tickSizes[symbol]));
              ask = parseFloat(orderUtil.calculateNearestSize(ask + me.tickSizes[symbol], me.tickSizes[symbol]));
            }

            eventEmitter.emit(
              'ticker',
              new TickerEvent(me.getName(), symbol, (me.tickers[symbol] = new Ticker(me.getName(), symbol, moment().format('X'), bid, ask)))
            );
          });
        }
      }
    };

    ws.onclose = function () {
      logger.info('BybitLinear: Connection closed.');

      for (const interval of me.intervals) {
        clearInterval(interval);
      }

      me.intervals = [];

      // retry connecting after some second to not bothering on high load
      setTimeout(() => {
        me.start(config, symbols);
      }, 10000);
    };

    symbols.forEach(symbol => {
      symbol.periods.forEach(period => {
        // for bot init prefill data: load latest candles from api
        this.queue.add(() => {
          const minutes = resample.convertPeriodToMinute(period);

          // from is required calculate to be inside window
          const from = Math.floor(new Date().getTime() / 1000) - minutes * 195 * 60;

          const s = `${me.getBaseUrl()}/public/linear/kline?symbol=${symbol.symbol}&from=${from}&interval=${minutes}`;
          request(s, { json: true }, async (err, res, body) => {
            if (err) {
              console.log(`BybitLinear: Candle backfill error: ${String(err)}`);
              logger.error(`BybitLinear: Candle backfill error: ${String(err)}`);
              return;
            }

            if (!body || !body.result || !Array.isArray(body.result)) {
              console.log(`BybitLinear: Candle backfill error: ${JSON.stringify(body)}`);
              logger.error(`Bybit Candle backfill error: ${JSON.stringify(body)}`);
              return;
            }

            const candleSticks = body.result.map(
              candle =>
                new ExchangeCandlestick(
                  me.getName(),
                  candle.symbol,
                  resample.convertMinuteToPeriod(candle.period),
                  candle.open_time,
                  candle.open,
                  candle.high,
                  candle.low,
                  candle.close,
                  candle.volume
                )
            );

            await this.candleImporter.insertThrottledCandles(
              candleSticks.map(candle => ExchangeCandlestick.createFromCandle(this.getName(), symbol.symbol, period, candle))
            );
          });
        });
      });
    });
  }

  openAuthWebsocket(symbols) {
    const websocketAuthed = new WebsocketClient(
      {
        key: this.apiKey,
        secret: this.apiSecret,
        market: 'linear'
      },
      {
        silly: () => {},
        debug: () => {},
        notice: () => {},
        info: () => {},
        warning: () => {},
        error: () => {}
      }
    );

    websocketAuthed.subscribe(['position', 'execution', 'order', 'stop_order']);

    // Listen to events coming from websockets. This is the primary data source
    websocketAuthed.on('update', data => {
      if (data.data && data.topic && ['order', 'stop_order'].includes(data.topic.toLowerCase())) {
        const orders = data.data;

        Bybit.createOrders(orders).forEach(order => {
          this.triggerOrder(order);
        });

        this.throttler.addTask(
          `bybit_linear_sync_all_orders`,
          async () => {
            await this.syncOrdersViaRestApi(symbols.map(symbol => symbol.symbol));
          },
          25
        );
      } else if (data.data && data.topic && data.topic.toLowerCase() === 'position') {
        // Not the same as api; where are the profits?
        /*
        const positionsRaw = data.data;
        const positions = [];

        positionsRaw.forEach(positionRaw => {
          // we are getting all postions for all sides; find active somehow
          if (positionRaw.bust_price === 0) {
            return;
          }

          if (!['buy', 'sell'].includes(positionRaw.side.toLowerCase())) {
            delete this.positions[positionRaw.symbol];
          } else {
            positions.push(positionRaw);
          }
        });

        Bybit.createPositionsWithOpenStateOnly(positions)
          .forEach(position => {
            this.positions[position.symbol] = position;
          });

        */

        this.throttler.addTask(`bybit_linear_sync_positions`, this.syncPositionViaRestApi.bind(this), 1545);
      }
    });

    websocketAuthed.on('open', ({ wsKey, event }) => {
      this.logger.debug(`BybitLinear: Private websocket opened for "${wsKey}"`);
    });

    websocketAuthed.on('response', response => {
      this.logger.debug(`BybitLinear: Private websocket response "${JSON.stringify(response)}"`);
    });

    websocketAuthed.on('close', () => {
      this.logger.error(`BybitLinear: Private websocket connection closed"`);
    });

    websocketAuthed.on('error', err => {
      const msg = `BybitLinear: Private websocket connection error "${JSON.stringify(err)}"`;
      this.logger.error(msg);
      console.error(msg);
    });
  }

  /**
   * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
   *
   * @param positions Position in raw json from Bitmex
   */
  fullPositionsUpdate(positions) {
    const openPositions = [];

    for (const positionItem of positions) {
      const position = positionItem.data;

      if ((position.symbol in this.positions && !['buy', 'sell'].includes(position.side.toLowerCase())) || position.size === 0) {
        delete this.positions[position.symbol];
        continue;
      }

      openPositions.push(position);
    }

    const currentPositions = {};

    for (const position of Bybit.createPositionsWithOpenStateOnly(openPositions)) {
      currentPositions[position.symbol] = position;
    }

    this.logger.debug(`BybitLinear: Positions via API updated: ${Object.keys(currentPositions).length}`);
    this.positions = currentPositions;
  }

  /**
   * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
   *
   * @param orders Orders in raw json from Bitmex
   */
  fullOrdersUpdate(orders) {
    const ourOrders = {};
    for (const order of Bybit.createOrders(orders).filter(o => o.status === 'open')) {
      ourOrders[order.id] = order;
    }

    this.orders = ourOrders;
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

  async findOrderById(id) {
    return (await this.getOrders()).find(order => order.id === id || order.id.toString === id.toString());
  }

  async getOrdersForSymbol(symbol) {
    return (await this.getOrders()).filter(order => order.symbol === symbol);
  }

  async getPositions() {
    const results = [];

    for (const x in this.positions) {
      const position = this.positions[x];
      results.push(position);
    }

    return results;
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
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order) {
    if (!(order instanceof ExchangeOrder)) {
      throw new Error('Invalid order given');
    }

    // dont overwrite state closed order
    if (order.id in this.orders && ['done', 'canceled'].includes(this.orders[order.id].status)) {
      delete this.orders[order.id];
      return;
    }

    this.orders[order.id] = order;
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
    return 'bybit_linear';
  }

  async order(order) {
    const parameters = Bybit.createOrderBody(order);

    const client = new LinearClient({
      key: this.apiKey,
      secret: this.apiSecret
    });

    // needs more uniqueness
    delete parameters.order_link_id;

    parameters.reduce_only = order.isReduceOnly();
    parameters.close_on_trigger = order.isReduceOnly();

    // limit and stops have different api endpoints
    const isConditionalOrder = this.isConditionalExchangeOrder(order);

    if (isConditionalOrder) {
      if (!this.tickers[order.getSymbol()]) {
        this.logger.error('BybitLinear: base_price based on ticker for conditional not found');
        return undefined;
      }

      // current ticker price is required on this api
      parameters.base_price = this.tickers[order.getSymbol()].bid;
    }

    let placedOrder;
    try {
      placedOrder = isConditionalOrder ? await client.placeConditionalOrder(parameters) : await client.placeActiveOrder(parameters);
    } catch (e) {
      this.logger.error(`Bybit: Invalid order create:${JSON.stringify([parameters, e])}`);
      return ExchangeOrder.createCanceledFromOrder(order);
    }

    if (!placedOrder?.result) {
      this.logger.error(`BybitLinear: Invalid order create:${JSON.stringify([parameters, placedOrder])}`);
      return ExchangeOrder.createCanceledFromOrder(order);
    }

    let returnOrder;
    Bybit.createOrders([placedOrder.result]).forEach(o => {
      this.triggerOrder(o);
      returnOrder = o;
    });

    return returnOrder;
  }

  async cancelOrder(id) {
    const order = await this.findOrderById(id);
    if (!order) {
      return undefined;
    }

    const isConditionalOrder = this.isConditionalExchangeOrder(order);

    const parameters = {
      api_key: this.apiKey,
      [isConditionalOrder ? 'stop_order_id' : 'order_id']: id,
      symbol: order.getSymbol(),
      timestamp: new Date().getTime()
    };

    const client = new LinearClient({
      key: this.apiKey,
      secret: this.apiSecret
    });

    let result;
    try {
      result = isConditionalOrder ? await client.cancelConditionalOrder(parameters) : await client.cancelActiveOrder(parameters);
    } catch (e) {
      this.logger.error(`Bybit: Invalid order create:${JSON.stringify([parameters, e])}`);
      return ExchangeOrder.createCanceledFromOrder(order);
    }

    if (id !== result?.result?.order_id && id !== result?.result?.stop_order_id) {
      this.logger.error(`BybitLinear: Invalid order cancel body:${JSON.stringify({ body: result, id: order })}`);
      return undefined;
    }

    const exchangeOrder = ExchangeOrder.createCanceled(order);
    this.triggerOrder(exchangeOrder);

    return exchangeOrder;
  }

  isConditionalExchangeOrder(order) {
    return [ExchangeOrder.TYPE_STOP, ExchangeOrder.TYPE_STOP_LIMIT].includes(order.getType());
  }

  async cancelAll(symbol) {
    const orders = [];

    for (const order of await this.getOrdersForSymbol(symbol)) {
      orders.push(await this.cancelOrder(order.id));
    }

    return orders;
  }

  async updateOrder(id, order) {
    if (!order.amount && !order.price) {
      throw Error('Invalid amount / price for update');
    }

    const currentOrder = await this.findOrderById(id);
    if (!currentOrder) {
      return undefined;
    }

    // cancel order; mostly it can already be canceled
    await this.cancelOrder(id);

    return this.order(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount));
  }

  /**
   * As a websocket fallback update positions also on REST
   */
  async syncOrdersViaRestApi(symbols) {
    const client = new ContractClient({
      key: this.apiKey,
      secret: this.apiSecret
    });

    let response;
    try {
      response = await client.getActiveOrders({ settleCoin: 'USDT' });
    } catch (e) {
      this.logger.error(`BybitLinear: Invalid orders response: ${e}`);
      return;
    }

    if (!response?.result?.list) {
      this.logger.error(`BybitLinear: Invalid orders response:${JSON.stringify(response)}`);
      return;
    }

    const orders = [];
    response.result.list.forEach(order => {
      const o = {};

      // underscore
      Object.keys(order).forEach(key => {
        o[CommonUtil.camelToSnakeCase(key)] = order[key];
      });

      orders.push(o);
    });

    this.logger.debug(`BybitLinear: Orders via API updated: ${orders.length}`);
    this.fullOrdersUpdate(orders);
  }

  /**
   * As a websocket fallback update orders also on REST
   */
  async syncPositionViaRestApi() {
    const client = new LinearClient({
      key: this.apiKey,
      secret: this.apiSecret
    });

    let response;
    try {
      response = await client.getPosition();
    } catch (e) {
      this.logger.error(`BybitLinear: Invalid position update:${JSON.stringify(e)}`);

      return;
    }

    if (!response?.result) {
      this.logger.error(`BybitLinear: Invalid position update:${JSON.stringify(response)}`);
      return;
    }

    this.fullPositionsUpdate(response.result || []);
  }

  getBaseUrl() {
    return 'https://api.bybit.com';
  }

  isInverseSymbol(symbol) {
    return false;
  }
};
