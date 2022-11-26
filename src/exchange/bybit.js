const WebSocket = require('ws');
const querystring = require('querystring');
const moment = require('moment');
const request = require('request');
const crypto = require('crypto');
const _ = require('lodash');
const Ticker = require('../dict/ticker');
const TickerEvent = require('../event/ticker_event');
const Order = require('../dict/order');
const ExchangeCandlestick = require('../dict/exchange_candlestick');

const resample = require('../utils/resample');

const Position = require('../dict/position');
const ExchangeOrder = require('../dict/exchange_order');

const orderUtil = require('../utils/order_util');

module.exports = class Bybit {
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
        result => {
          return result && result.response && result.response.statusCode >= 500;
        }
      )
      .then(response => {
        const body = JSON.parse(response.body);
        if (!body.result) {
          this.logger.error(`Bybit: invalid instruments request: ${response.body}`);
          return;
        }

        body.result.forEach(instrument => {
          tickSizes[instrument.name] = parseFloat(instrument.price_filter.tick_size);
          lotSizes[instrument.name] = parseFloat(instrument.lot_size_filter.qty_step);
        });
      });

    const ws = new WebSocket('wss://stream.bybit.com/realtime');

    const me = this;
    ws.onopen = function() {
      me.logger.info('Bybit: Connection opened.');

      symbols.forEach(symbol => {
        symbol.periods.forEach(p => {
          const periodMinute = resample.convertPeriodToMinute(p);

          ws.send(JSON.stringify({ op: 'subscribe', args: [`klineV2.${periodMinute}.${symbol.symbol}`] }));
        });

        ws.send(JSON.stringify({ op: 'subscribe', args: [`instrument_info.100ms.${symbol.symbol}`] }));
      });

      if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
        me.logger.info('Bybit: sending auth request');
        me.apiKey = config.key;
        me.apiSecret = config.secret;

        const expires = new Date().getTime() + 10000;
        const signature = crypto
          .createHmac('sha256', config.secret)
          .update(`GET/realtime${expires}`)
          .digest('hex');

        ws.send(JSON.stringify({ op: 'auth', args: [config.key, expires, signature] }));

        // load full order and positions in intervals; in case websocket is out opf sync
        setTimeout(() => {
          me.intervals.push(
            setInterval(
              (function f() {
                me.throttler.addTask(
                  `bybit_sync_all_orders`,
                  async () => {
                    await me.syncOrdersViaRestApi(symbols.map(symbol => symbol.symbol));
                  },
                  1245
                );

                me.throttler.addTask(`bybit_sync_positions`, me.syncPositionViaRestApi.bind(me), 1245);
                return f;
              })(),
              60000
            )
          );
        }, 5000);
      } else {
        me.logger.info('Bybit: Starting as anonymous; no trading possible');
      }
    };

    ws.onmessage = async function(event) {
      if (event.type === 'message') {
        const data = JSON.parse(event.data);

        if ('success' in data && data.success === false) {
          me.logger.error(`Bybit: error ${event.data}`);
          console.log(`Bybit: error ${event.data}`);
        } else if ('success' in data && data.success === true) {
          if (data.request && data.request.op === 'auth') {
            me.logger.info('Bybit: Auth successful');

            ws.send(JSON.stringify({ op: 'subscribe', args: ['order'] }));
            ws.send(JSON.stringify({ op: 'subscribe', args: ['stop_order'] }));
            ws.send(JSON.stringify({ op: 'subscribe', args: ['position'] }));
            ws.send(JSON.stringify({ op: 'subscribe', args: ['execution'] }));
          }
        } else if (data.topic && data.topic.startsWith('kline.')) {
          const candle = data.data;

          const candleStick = new ExchangeCandlestick(
            me.getName(),
            candle.symbol,
            candle.interval,
            candle.open_time,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume
          );

          await me.candleImporter.insertThrottledCandles([candleStick]);
        } else if (data.data && data.topic && data.topic.startsWith('instrument_info.')) {
          let instruments = [];
          if (data.data.update) {
            instruments = data.data.update;
          } else if (data.data.last_price_e4) {
            instruments = [data.data];
          }

          instruments.forEach(instrument => {
            // update and init
            if (!instrument.last_price_e4) {
              return;
            }

            const price = instrument.last_price_e4 / 10000;

            let bid = price;
            let ask = price;

            const { symbol } = instrument;

            // add price spread around the last price; as we not getting the bid and ask of the orderbook directly
            // prevent also floating issues
            if (symbol in me.tickSizes) {
              bid = parseFloat(orderUtil.calculateNearestSize(bid - me.tickSizes[symbol], me.tickSizes[symbol]));
              ask = parseFloat(orderUtil.calculateNearestSize(ask + me.tickSizes[symbol], me.tickSizes[symbol]));
            }

            eventEmitter.emit(
              'ticker',
              new TickerEvent(
                me.getName(),
                symbol,
                (me.tickers[symbol] = new Ticker(me.getName(), symbol, moment().format('X'), bid, ask))
              )
            );
          });
        } else if (data.data && data.topic && ['order', 'stop_order'].includes(data.topic.toLowerCase())) {
          const orders = data.data;

          Bybit.createOrders(orders).forEach(order => {
            me.triggerOrder(order);
          });

          me.throttler.addTask(
            `bybit_sync_all_orders`,
            async () => {
              await me.syncOrdersViaRestApi(symbols.map(symbol => symbol.symbol));
            },
            1245
          );
        } else if (data.data && data.topic && data.topic.toLowerCase() === 'position') {
          const positionsRaw = data.data;
          const positions = [];

          positionsRaw.forEach(positionRaw => {
            if (!['buy', 'sell'].includes(positionRaw.side.toLowerCase())) {
              delete me.positions[positionRaw.symbol];
            } else {
              positions.push(positionRaw);
            }
          });

          Bybit.createPositionsWithOpenStateOnly(positions).forEach(position => {
            me.positions[position.symbol] = position;
          });

          me.throttler.addTask(`bybit_sync_positions`, me.syncPositionViaRestApi.bind(me), 1545);
        }
      }
    };

    ws.onclose = function() {
      logger.info('Bybit: Connection closed.');

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

          const s = `${me.getBaseUrl()}/v2/public/kline/list?symbol=${symbol.symbol}&from=${from}&interval=${minutes}`;
          request(s, { json: true }, async (err, res, body) => {
            if (err) {
              console.log(`Bybit: Candle backfill error: ${String(err)}`);
              logger.error(`Bybit: Candle backfill error: ${String(err)}`);
              return;
            }

            if (!body || !body.result || !Array.isArray(body.result)) {
              console.log(`Bybit: Candle backfill error: ${JSON.stringify(body)}`);
              logger.error(`Bybit Candle backfill error: ${JSON.stringify(body)}`);
              return;
            }

            const candleSticks = body.result.map(candle => {
              return new ExchangeCandlestick(
                me.getName(),
                candle.symbol,
                period,
                candle.open_time,
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume
              );
            });

            await this.candleImporter.insertThrottledCandles(
              candleSticks.map(candle => {
                return ExchangeCandlestick.createFromCandle(this.getName(), symbol.symbol, period, candle);
              })
            );
          });
        });
      });
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

      if (position.symbol in this.positions && !['buy', 'sell'].includes(position.side.toLowerCase())) {
        delete this.positions[position.symbol];
        continue;
      }

      openPositions.push(position);
    }

    const currentPositions = {};

    for (const position of Bybit.createPositionsWithOpenStateOnly(openPositions)) {
      currentPositions[position.symbol] = position;
    }

    this.logger.debug(`Bybit: Positions via API updated: ${Object.keys(currentPositions).length}`);
    this.positions = currentPositions;
  }

  /**
   * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
   *
   * @param orders Orders in raw json from Bitmex
   */
  fullOrdersUpdate(orders) {
    const ourOrders = {};
    for (const order of Bybit.createOrders(orders).filter(order => order.status === 'open')) {
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
    return (await this.getOrders()).find(order => order.id === id || order.id == id);
  }

  async getOrdersForSymbol(symbol) {
    return (await this.getOrders()).filter(order => order.symbol === symbol);
  }

  async getPositions() {
    const results = [];

    for (const x in this.positions) {
      let position = this.positions[x];
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
      throw 'Invalid order given';
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
    return 'bybit';
  }

  async order(order) {
    const parameters = Bybit.createOrderBody(order);

    parameters.api_key = this.apiKey;
    parameters.timestamp = new Date().getTime();

    // disabled: bind error on api
    // delete parameters['reduce_only']

    // limit and stops have different api endpoints
    const isConditionalOrder = this.isConditionalExchangeOrder(order);

    if (isConditionalOrder) {
      if (!this.tickers[order.getSymbol()]) {
        this.logger.error('Bybit: base_price based on ticker for conditional not found');
        return undefined;
      }

      // current ticker price is required on this api
      parameters.base_price = this.tickers[order.getSymbol()].bid;
    }

    const parametersSorted = {};
    Object.keys(parameters)
      .sort()
      .forEach(key => {
        parametersSorted[key] = parameters[key];
      });

    parametersSorted.sign = crypto
      .createHmac('sha256', this.apiSecret)
      .update(querystring.stringify(parametersSorted))
      .digest('hex');

    let url;
    if (isConditionalOrder) {
      url = `${this.getBaseUrl()}/v2/private/stop-order/create`;
    } else {
      url = `${this.getBaseUrl()}/v2/private/order/create`;
    }

    await this.updateLeverage(order.getSymbol());

    const result = await this.requestClient.executeRequestRetry(
      {
        method: 'POST',
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(parametersSorted)
      },
      result => {
        return result && result.response && result.response.statusCode >= 500;
      }
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      this.logger.error(`Bybit: Invalid order create:${JSON.stringify([error, body])}`);
      return ExchangeOrder.createCanceledFromOrder(order);
    }

    const json = JSON.parse(body);
    if (!json.result) {
      this.logger.error(`Bybit: Invalid order create body:${JSON.stringify([body, parametersSorted])}`);
      return ExchangeOrder.createCanceledFromOrder(order);
    }

    let returnOrder;
    Bybit.createOrders([json.result]).forEach(order => {
      this.triggerOrder(order);
      returnOrder = order;
    });

    if (!isConditionalOrder) {
      const restOrder = await this.validatePlacedOrder(returnOrder);
      if (restOrder) {
        returnOrder = restOrder;
      }
    }

    return returnOrder;
  }

  /**
   * In case the order was not able to place we need to wait some "ms" and call order via API again
   * @TODO use the websocket event
   *
   * @param order
   * @returns {Promise<any>}
   */
  validatePlacedOrder(order) {
    return new Promise(resolve => {
      setTimeout(async () => {
        // calling a direct "order_id" is not given any result
        // we fetch latest order and find our id
        const parameters2 = {
          api_key: this.apiKey,
          timestamp: new Date().getTime(),
          symbol: order.symbol,
          limit: 5
        };

        const parametersSorted2 = {};
        Object.keys(parameters2)
          .sort()
          .forEach(key => (parametersSorted2[key] = parameters2[key]));

        parametersSorted2.sign = crypto
          .createHmac('sha256', this.apiSecret)
          .update(querystring.stringify(parametersSorted2))
          .digest('hex');

        const url1 = `${this.getBaseUrl()}/v2/private/order/list?${querystring.stringify(parametersSorted2)}`;
        const placedOrder = await this.requestClient.executeRequestRetry(
          {
            method: 'GET',
            url: url1,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            }
          },
          result => {
            return result && result.response && result.response.statusCode >= 500;
          }
        );

        const { body } = placedOrder;

        const json = JSON.parse(body);
        if (!json.result || !json.result.data) {
          this.logger.error(`Bybit: Invalid order body:${JSON.stringify({ body: body })}`);
          resolve();
        }

        const find = json.result.data.find(o => (o.order_id = order.id));
        if (!find) {
          this.logger.error(`Bybit: Order not found:${JSON.stringify({ body: body })}`);
          resolve();
        }

        const orders = Bybit.createOrders([find]);
        resolve(orders[0]);
      }, 1000);
    });
  }

  /**
   * Set the configured leverage size "0-100" for pair before creating an order default "5" if not provided in configuration
   *
   * symbol configuration via:
   *
   * "extra.bybit_leverage": 5
   *
   * @param symbol
   */
  async updateLeverage(symbol) {
    const config = this.symbols.find(cSymbol => cSymbol.symbol === symbol);
    if (!config) {
      this.logger.error(`Bybit: Invalid leverage config for:${symbol}`);
      return;
    }

    // use default leverage to "3"
    const leverageSize = _.get(config, 'extra.bybit_leverage', 5);
    if (leverageSize < 0 || leverageSize > 100) {
      throw Error(`Invalid leverage size for: ${leverageSize} ${symbol}`);
    }

    // we dont get the selected leverage value in websocket or api endpoints
    // so we update them only in a given time window; system overload is often blocked
    if (symbol in this.leverageUpdated && this.leverageUpdated[symbol] > moment().subtract(45, 'minutes')) {
      this.logger.debug(`Bybit: leverage update not needed: ${symbol}`);
      return;
    }

    if (await this.getPositionForSymbol(symbol)) {
      this.logger.debug(`Bybit: leverage update with open position not needed: ${symbol}`);
      return;
    }

    const parameters = {
      api_key: this.apiKey,
      leverage: leverageSize,
      symbol: symbol,
      timestamp: new Date().getTime()
    };

    parameters.sign = crypto
      .createHmac('sha256', this.apiSecret)
      .update(querystring.stringify(parameters))
      .digest('hex');

    const result = await this.requestClient.executeRequestRetry(
      {
        method: 'POST',
        url: `${this.getBaseUrl()}/user/leverage/save`,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(parameters)
      },
      r => {
        return r && r.response && r.response.statusCode >= 500;
      }
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      this.logger.error(`Bybit: Invalid leverage update request:${JSON.stringify({ error: error, body: body })}`);
      return;
    }

    const json = JSON.parse(body);
    if (json.ret_msg === 'ok' || json.ret_code === 0) {
      this.logger.debug(`Bybit: Leverage update:${JSON.stringify(symbol)}`);
      // set updated indicator; for not update on next request
      this.leverageUpdated[symbol] = new Date();
      return;
    }

    this.logger.error(`Bybit: Leverage update error invalid body:${body}`);
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

    parameters.sign = crypto
      .createHmac('sha256', this.apiSecret)
      .update(querystring.stringify(parameters))
      .digest('hex');

    let url;
    if (isConditionalOrder) {
      url = `${this.getBaseUrl()}/v2/private/stop-order/cancel?${querystring.stringify(parameters)}`;
    } else {
      url = `${this.getBaseUrl()}/v2/private/order/cancel?${querystring.stringify(parameters)}`;
    }

    const result = await this.requestClient.executeRequestRetry(
      {
        method: 'post',
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(parameters)
      },
      result => {
        return result && result.response && result.response.statusCode >= 500;
      }
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      this.logger.error(`Bybit: Invalid order cancel:${JSON.stringify({ error: error, body: body })}`);
      return undefined;
    }

    const json = JSON.parse(body);
    if (!json.result) {
      this.logger.error(`Bybit: Invalid order cancel body:${JSON.stringify({ body: body, id: order })}`);
      return undefined;
    }

    if (id !== json.result.order_id && id !== json.result.stop_order_id) {
      this.logger.error(`Bybit: Invalid order cancel body:${JSON.stringify({ body: body, id: order })}`);
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
   * Convert incoming positions only if they are open
   *
   * @param positions
   * @returns {*}
   */
  static createPositionsWithOpenStateOnly(positions) {
    return positions
      .filter(position => {
        return ['buy', 'sell'].includes(position.side.toLowerCase());
      })
      .map(position => {
        const side = position.side.toLowerCase() === 'buy' ? 'long' : 'short';
        let { size } = position;

        if (side === 'short') {
          size *= -1;
        }

        return new Position(
          position.symbol,
          side,
          size,
          position.unrealised_pnl && position.position_value
            ? parseFloat(((position.unrealised_pnl / position.position_value) * 100).toFixed(2))
            : null,
          new Date(),
          parseFloat(position.entry_price),
          new Date()
        );
      });
  }

  static createOrders(orders) {
    return orders.map(originOrder => {
      const order = originOrder;

      // some endpoints / websocket request merge extra field into nested "ext_fields"; just merge them into main
      for (const [key, value] of Object.entries(order.ext_fields || {})) {
        // dont overwrite?
        if (key in order) {
          continue;
        }

        order[key] = value;
      }

      let retry = false;

      let status;

      let orderStatus;
      let orderType = ExchangeOrder.TYPE_UNKNOWN;

      if (order.order_status) {
        orderStatus = order.order_status.toLowerCase();
      } else if (order.stop_order_status && order.stop_order_status.toLowerCase() === 'untriggered') {
        orderStatus = 'new';
        orderType = ExchangeOrder.TYPE_STOP;
      }

      // via websocket; conditional is different here
      if (order.stop_order_type) {
        orderType = ExchangeOrder.TYPE_STOP;
      }

      if (
        ['new', 'partiallyfilled', 'pendingnew', 'doneforday', 'stopped', 'created', 'untriggered'].includes(
          orderStatus
        )
      ) {
        status = 'open';
      } else if (orderStatus === 'filled') {
        status = 'done';
      } else if (orderStatus === 'canceled' || orderStatus === 'cancelled' || orderStatus === 'deactivated') {
        status = 'canceled';
      } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
        status = 'rejected';
        retry = true;
      }

      const ordType = order.order_type.toLowerCase();

      // secure the value
      switch (ordType) {
        case 'limit':
          orderType = ExchangeOrder.TYPE_LIMIT;
          break;
        case 'stop':
          orderType = ExchangeOrder.TYPE_STOP;
          break;
      }

      if (orderType === ExchangeOrder.TYPE_LIMIT && order.stop_px && parseFloat(order.stop_px) > 0) {
        orderType = ExchangeOrder.TYPE_STOP_LIMIT;
      }

      // new format
      if (orderType === ExchangeOrder.TYPE_LIMIT && order.stop_order_type === 'Stop') {
        orderType = ExchangeOrder.TYPE_STOP_LIMIT;
      }

      let { price } = order;
      if (orderType === 'stop') {
        // old stuff; can be dropped?
        price = parseFloat(order.stop_px || undefined);

        // new format
        if (!price || price === 0.0) {
          price = parseFloat(order?.trigger_price);
        }
      }

      const options = {};
      if (order.reduce_only === true || order.ext_fields?.reduce_only === true) {
        options.reduce_only = true;
      }

      let createdAt;
      if (order.timestamp) {
        createdAt = new Date(order.timestamp);
      } else if (order.created_at) {
        createdAt = new Date(order.created_at);
      } else if (order.created_time) {
        createdAt = new Date(isNaN(order.created_time) ? order.created_time : parseInt(order.created_time));
      }

      let orderId;
      if (order.order_id) {
        orderId = order.order_id;
      } else if (order.stop_order_id) {
        orderId = order.stop_order_id;
      }

      if (!status) {
        throw Error(`Bybit: Invalid exchange order price:${JSON.stringify([order])}`);
      }

      if (!price || price === 0) {
        throw Error(`Bybit: Invalid exchange order price:${JSON.stringify([order])}`);
      }

      return new ExchangeOrder(
        orderId,
        order.symbol,
        status,
        price,
        order.qty,
        retry,
        order.order_link_id ? order.order_link_id : undefined,
        order.side.toLowerCase() === 'sell' ? 'sell' : 'buy', // secure the value,
        orderType,
        createdAt,
        new Date(),
        JSON.parse(JSON.stringify(order)),
        options
      );
    });
  }

  /**
   * As a websocket fallback update positions also on REST
   */
  async syncOrdersViaRestApi(symbols) {
    const promises = [];

    symbols.forEach(symbol => {
      // there is not full active order state; we need some more queries
      ['Created', 'New', 'PartiallyFilled'].forEach(orderStatus => {
        promises.push(async () => {
          const parameter = {
            api_key: this.apiKey,
            limit: 100,
            order_status: orderStatus,
            symbol: symbol,
            timestamp: new Date().getTime() // 1 min in the future
          };

          parameter.sign = crypto
            .createHmac('sha256', this.apiSecret)
            .update(querystring.stringify(parameter))
            .digest('hex');

          const url = `${this.getBaseUrl()}/v2/private/order/list?${querystring.stringify(parameter)}`;
          const result = await this.requestClient.executeRequestRetry(
            {
              url: url,
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
              }
            },
            r => {
              return r && r.response && r.response.statusCode >= 500;
            }
          );

          const { error } = result;
          const { response } = result;
          const { body } = result;

          if (error || !response || response.statusCode !== 200) {
            this.logger.error(
              `Bybit: Invalid orders response:${JSON.stringify({
                error: error,
                body: body,
                orderStatus: orderStatus
              })}`
            );

            throw new Error();
          }

          let json;
          try {
            json = JSON.parse(body);
          } catch (e) {
            json = [];
          }

          if (!json.result || !json.result.data) {
            this.logger.error(`Bybit: Invalid orders json:${JSON.stringify({ body: body })}`);

            throw new Error('Invalid orders json');
          }

          return json.result.data;
        });
      });

      // stop order are special endpoint
      promises.push(async () => {
        const parameter = {
          api_key: this.apiKey,
          limit: 100,
          symbol: symbol,
          timestamp: new Date().getTime()
        };

        parameter.sign = crypto
          .createHmac('sha256', this.apiSecret)
          .update(querystring.stringify(parameter))
          .digest('hex');

        const url = `${this.getBaseUrl()}/v2/private/stop-order/list?${querystring.stringify(parameter)}`;
        const result = await this.requestClient.executeRequestRetry(
          {
            url: url,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            }
          },
          r => {
            return r && r.response && r.response.statusCode >= 500;
          }
        );

        const { error } = result;
        const { response } = result;
        const { body } = result;

        if (error || !response || response.statusCode !== 200) {
          this.logger.error(`Bybit: Invalid order update: ${symbol} - ${JSON.stringify({ error: error, body: body })}`);

          return [];
        }

        let json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = [];
        }

        if (!json.result || !json.result.data) {
          this.logger.error(`Bybit: Invalid stop-order json: ${symbol} - ${JSON.stringify({ body: body })}`);
          return [];
        }

        return json.result.data.filter(order => order.stop_order_status === 'Untriggered');
      });
    });

    let results;
    try {
      results = await Promise.all(promises.map(fn => fn()));
    } catch (e) {
      this.logger.error(`Bybit: Orders via API updated stopped: ${e.message}`);
      return;
    }

    const orders = [];
    results.forEach(order => {
      orders.push(...order);
    });

    this.logger.debug(`Bybit: Orders via API updated: ${orders.length}`);
    this.fullOrdersUpdate(orders);
  }

  /**
   * As a websocket fallback update orders also on REST
   */
  async syncPositionViaRestApi() {
    const parameter = {
      api_key: this.apiKey,
      timestamp: new Date().getTime() // 1 min in the future
    };

    parameter.sign = crypto
      .createHmac('sha256', this.apiSecret)
      .update(querystring.stringify(parameter))
      .digest('hex');

    const url = `${this.getBaseUrl()}/v2/private/position/list?${querystring.stringify(parameter)}`;
    const result = await this.requestClient.executeRequestRetry(
      {
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      },
      r => {
        return r && r.response && r.response.statusCode >= 500;
      }
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      this.logger.error(`Bybit: Invalid position update:${JSON.stringify({ error: error, body: body })}`);
      return;
    }

    const json = JSON.parse(body);
    if (!json.result) {
      this.logger.error(`Bybit: Invalid position update:${JSON.stringify({ body: body })}`);
      return;
    }

    this.fullPositionsUpdate(json.result);
  }

  /**
   * Create a REST API body for Bitmex based on our internal order
   *
   * @param order
   * @returns {{symbol: *, orderQty: *, ordType: undefined, text: string}}
   */
  static createOrderBody(order) {
    if (!order.getAmount() && !order.getPrice() && !order.getSymbol()) {
      throw 'Invalid amount for update';
    }

    let orderType;

    const ourOrderType = order.getType();
    if (!ourOrderType) {
      orderType = 'Limit';
    } else if (ourOrderType === 'limit') {
      orderType = 'Limit';
    } else if (ourOrderType === 'stop') {
      orderType = 'Stop';
    } else if (ourOrderType === 'market') {
      orderType = 'Market';
    }

    if (!orderType) {
      throw 'Invalid order type';
    }

    const body = {
      symbol: order.getSymbol(),
      qty: order.getAmount(),
      order_type: orderType,
      time_in_force: 'GoodTillCancel'
    };

    if (order.isPostOnly()) {
      body.time_in_force = 'PostOnly';
    }

    if (order.options && order.options.close === true && orderType === 'Limit') {
      body.reduce_only = true;
    }

    if (order.options && order.options.close === true && orderType === 'Stop') {
      body.close_on_trigger = true;
    }

    if (orderType === 'Stop') {
      body.stop_px = order.getPrice();
    } else if (orderType === 'Limit') {
      body.price = order.getPrice();
    }

    body.side = order.isShort() ? 'Sell' : 'Buy';

    if (order.id) {
      body.order_link_id = order.getId();
    }

    // conditional stop is market
    if (orderType === 'Stop') {
      body.order_type = 'Market';
    }

    return body;
  }

  getBaseUrl() {
    return 'https://api.bybit.com';
  }

  isInverseSymbol(symbol) {
    return true;
  }
};
