const moment = require('moment');
const request = require('request');
const crypto = require('crypto');
const BitMEXClient = require('bitmex-realtime-api');
const _ = require('lodash');
const querystring = require('querystring');
const Candlestick = require('./../dict/candlestick');
const Ticker = require('./../dict/ticker');
const ExchangeCandlestick = require('../dict/exchange_candlestick');

const TickerEvent = require('./../event/ticker_event');

const resample = require('./../utils/resample');

const Position = require('../dict/position');
const Order = require('../dict/order');
const ExchangeOrder = require('../dict/exchange_order');

const orderUtil = require('../utils/order_util');

module.exports = class Bitmex {
  constructor(eventEmitter, requestClient, candlestickResample, logger, queue, candleImporter) {
    this.eventEmitter = eventEmitter;
    this.requestClient = requestClient;
    this.candlestickResample = candlestickResample;
    this.logger = logger;
    this.queue = queue;
    this.candleImporter = candleImporter;

    this.apiKey = undefined;
    this.apiSecret = undefined;
    this.tickSizes = {};
    this.lotSizes = {};
    this.leverageUpdated = {};
    this.retryOverloadMs = 944; // Overload: API docs says use 500ms we give us more space
    this.retryOverloadLimit = 5; // Overload: Retry until fail finally

    this.positions = {};
    this.orders = {};
    this.tickers = {};
    this.symbols = [];

    this.inversedSymboles = [];
  }

  backfill(symbol, period, start) {
    return new Promise((resolve, reject) => {
      const query = querystring.stringify({
        binSize: period,
        partial: false,
        symbol: symbol,
        count: 500,
        reverse: false,
        startTime: moment(start).format()
      });

      request(`${this.getBaseUrl()}/api/v1/trade/bucketed?${query}`, { json: true }, (err, res, body) => {
        if (err) {
          console.log(`Bitmex: Candle backfill error: ${String(err)}`);
          reject();
          return;
        }

        if (!Array.isArray(body)) {
          console.log(`Bitmex: Candle backfill error: ${JSON.stringify(body)}`);
          reject();
          return;
        }

        resolve(
          body.map(candle => {
            return new Candlestick(
              moment(candle.timestamp).format('X'),
              candle.open,
              candle.high,
              candle.low,
              candle.close,
              candle.volume
            );
          })
        );
      });
    });
  }

  start(config, symbols) {
    const { eventEmitter } = this;
    const { logger } = this;
    const { tickSizes } = this;
    const { lotSizes } = this;

    this.symbols = symbols;
    this.positions = {};
    this.orders = {};
    this.leverageUpdated = {};

    const opts = {
      testnet: this.getBaseUrl().includes('testnet')
    };

    if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
      opts.apiKeyID = this.apiKey = config.key;
      opts.apiKeySecret = this.apiSecret = config.secret;
    }

    const client = new BitMEXClient(opts);

    client.on('error', error => {
      console.error(error);
      logger.error(`Bitmex: error ${String(error)}`);
    });

    client.on('open', () => {
      logger.info('Bitmex: Connection opened.');
      console.log('Bitmex: Connection opened.');
    });

    client.on('close', () => {
      logger.info('Bitmex: Connection closed.');
      console.log('Bitmex: Connection closed.');
    });

    const me = this;
    client.on('end', () => {
      logger.info('Bitmex: Connection closed.');
      console.log('Bitmex: Connection closed.');

      // retry connecting after some second to not bothering on high load
      setTimeout(() => {
        me.start(config, symbols);
      }, 10000);
    });

    symbols.forEach(symbol => {
      const resamples = {};
      let myPeriods = [];

      symbol.periods.forEach(period => {
        if (period !== '15m') {
          myPeriods.push(period);
          return;
        }

        myPeriods.push('5m');

        if (!resamples[symbol.symbol]) {
          resamples[symbol.symbol] = {};
        }

        if (!resamples[symbol.symbol]['5m']) {
          resamples[symbol.symbol]['5m'] = [];
        }

        resamples[symbol.symbol]['5m'].push('15m');
      });

      myPeriods = Array.from(new Set(myPeriods));

      myPeriods.forEach(period => {
        // for bot init prefill data: load latest candles from api
        this.queue.add(() => {
          request(
            `${me.getBaseUrl()}/api/v1/trade/bucketed?binSize=${period}&partial=false&symbol=${
              symbol.symbol
            }&count=750&reverse=true`,
            { json: true },
            async (err, res, body) => {
              if (err) {
                console.log(`Bitmex: Candle backfill error: ${String(err)}`);
                logger.error(`Bitmex: Candle backfill error: ${String(err)}`);
                return;
              }

              if (!Array.isArray(body)) {
                console.log(`Bitmex: Candle backfill error: ${JSON.stringify(body)}`);
                logger.error(`Bitmex Candle backfill error: ${JSON.stringify(body)}`);
                return;
              }

              const candleSticks = body.map(candle => {
                return new Candlestick(
                  moment(candle.timestamp).format('X'),
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

              if (
                resamples[symbol.symbol] &&
                resamples[symbol.symbol][period] &&
                resamples[symbol.symbol][period].length > 0
              ) {
                resamples[symbol.symbol][period].forEach(async periodTo => {
                  const resampledCandles = resample.resampleMinutes(
                    candleSticks.slice(),
                    resample.convertPeriodToMinute(periodTo) // 15m > 15
                  );

                  const candles = resampledCandles.map(candle => {
                    return ExchangeCandlestick.createFromCandle(this.getName(), symbol.symbol, periodTo, candle);
                  });

                  await this.candleImporter.insertThrottledCandles(candles);
                });
              }
            }
          );
        });

        // listen for new incoming candles
        client.addStream(symbol.symbol, `tradeBin${period}`, async candles => {
          // we need a force reset; candles are like queue
          const myCandles = candles.slice();
          candles.length = 0;

          const candleSticks = myCandles.map(candle => {
            return new Candlestick(
              moment(candle.timestamp).format('X'),
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

          if (
            resamples[symbol.symbol] &&
            resamples[symbol.symbol][period] &&
            resamples[symbol.symbol][period].length > 0
          ) {
            resamples[symbol.symbol][period].forEach(async periodTo => {
              await me.candlestickResample.resample(this.getName(), symbol.symbol, period, periodTo, true);
            });
          }
        });
      });

      client.addStream(symbol.symbol, 'instrument', instruments => {
        instruments.forEach(instrument => {
          tickSizes[symbol.symbol] = instrument.tickSize;
          lotSizes[symbol.symbol] = instrument.lotSize;

          if (instrument.isInverse && !this.inversedSymboles.includes(symbol.symbol)) {
            this.inversedSymboles.push(symbol.symbol);
          }

          eventEmitter.emit(
            'ticker',
            new TickerEvent(
              this.getName(),
              symbol.symbol,
              (this.tickers[symbol.symbol] = new Ticker(
                this.getName(),
                symbol.symbol,
                moment().format('X'),
                instrument.bidPrice,
                instrument.askPrice
              ))
            )
          );
        });
      });

      /*
             * This stream alerts me of any executions of my orders. The results of the executions are seen in the postions stream

            client.addStream(symbol['symbol'], 'execution', (data, symbol, tableName) => {
            })
             */

      /*
            Disable: huge traffic with no use case right now
            var lastTime = moment().format('X');

            client.addStream(symbol['symbol'], 'orderBook10', (books) => {
                let s = moment().format('X');

                // throttle orderbook; updated to often
                if ((lastTime - s) > -5) {
                    return;
                }

                lastTime = s;

                books.forEach(function(book) {
                    eventEmitter.emit('orderbook', new OrderbookEvent(
                        'bitmex',
                        symbol['symbol'],
                        new Orderbook(book['bids'].map(function(item) {
                            return {'price': item[0], 'size': item[1]}
                        }), book['asks'].map(function(item) {
                            return {'price': item[0], 'size': item[1]}
                        }))
                    ));
                })
            });
            */
    });

    if (this.apiKey && this.apiSecret) {
      // in addition to websocket also try to catch positions via API; run in directly and in interval
      const apiOrderInterval = _.get(config, 'extra.bitmex_rest_order_sync', 45000);
      if (apiOrderInterval > 5000) {
        setInterval(
          (function f() {
            me.syncPositionViaRestApi();
            me.syncOrdersViaRestApi();
            return f;
          })(),
          apiOrderInterval
        );
      }

      client.addStream('*', 'order', orders => {
        for (const order of Bitmex.createOrders(orders)) {
          this.orders[order.id] = order;
        }
      });

      // open position listener; provides only per position updates; no overall update
      client.addStream('*', 'position', positions => {
        me.deltaPositionsUpdate(positions);
      });
    } else {
      this.logger.info('Bitmex: Starting as anonymous; no trading possible');
    }
  }

  /**
   * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
   *
   * @param positions Position in raw json from Bitmex
   */
  fullPositionsUpdate(positions) {
    const openPositions = [];

    for (const position of positions) {
      if (position.symbol in this.positions && position.isOpen !== true) {
        delete this.positions[position.symbol];
      } else {
        openPositions.push(position);
      }
    }

    const currentPositions = {};

    for (const position of Bitmex.createPositionsWithOpenStateOnly(openPositions)) {
      currentPositions[position.symbol] = position;
    }

    this.positions = currentPositions;
  }

  /**
   * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
   *
   * @param orders Orders in raw json from Bitmex
   */
  fullOrdersUpdate(orders) {
    const ourOrders = {};
    for (const order of Bitmex.createOrders(orders).filter(order => order.status === 'open')) {
      ourOrders[order.id] = order;
    }

    this.orders = ourOrders;
  }

  /**
   * Updates delta positions; Websocket just given use one position per callback
   *
   * @param positions Position in raw json from Bitmex
   */
  deltaPositionsUpdate(positions) {
    const openPositions = [];

    for (const position of positions) {
      if (position.symbol in this.positions && position.isOpen !== true) {
        delete this.positions[position.symbol];
      } else {
        openPositions.push(position);
      }
    }

    for (const position of Bitmex.createPositionsWithOpenStateOnly(openPositions)) {
      this.positions[position.symbol] = position;
    }
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
    return 'bitmex';
  }

  order(order) {
    const data = Bitmex.createOrderBody(order);

    const verb = 'POST';
    const path = '/api/v1/order';
    const expires = new Date().getTime() + 60 * 1000; // 1 min in the future
    const postBody = JSON.stringify(data);
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(verb + path + expires + postBody)
      .digest('hex');

    const headers = {
      'content-type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'api-expires': expires,
      'api-key': this.apiKey,
      'api-signature': signature
    };

    const { logger } = this;
    const me = this;
    return new Promise(async (resolve, reject) => {
      // update leverage for pair position
      await this.updateLeverage(order.symbol);

      const result = await this.requestClient.executeRequestRetry(
        {
          headers: headers,
          url: this.getBaseUrl() + path,
          method: verb,
          body: postBody
        },
        result => {
          return result && result.response && result.response.statusCode === 503;
        },
        this.retryOverloadMs,
        this.retryOverloadLimit
      );

      const { error } = result;
      const { body } = result;

      if (error) {
        logger.error(`Bitmex: Invalid order update request:${JSON.stringify({ error: error, body: body })}`);
        reject();

        return;
      }

      if (result.response && result.response.statusCode >= 400 && result.response.statusCode < 500) {
        logger.error(`Bitmex: Invalid order created request cancel ordering:${JSON.stringify({ body: body })}`);

        resolve(ExchangeOrder.createCanceledFromOrder(order));
        return;
      }

      const orderResponse = JSON.parse(body);
      if (orderResponse.error) {
        logger.error(`Bitmex: Invalid order created request:${JSON.stringify({ body: body })}`);

        reject();
        return;
      }

      logger.info(`Bitmex: Order created:${JSON.stringify({ body: body })}`);

      const orders = Bitmex.createOrders([orderResponse]);
      orders.forEach(order => {
        me.triggerOrder(order);
      });

      resolve(orders[0]);
    });
  }

  /**
   * Set the configured leverage size "0-100" for pair before creating an order default "3" if not provided in configuration
   *
   * symbol configuration via:
   *
   * "extra.bitmex_leverage": 5
   *
   * @param symbol
   * @returns {Promise<any>}
   */
  async updateLeverage(symbol) {
    const { logger } = this;

    return new Promise((resolve, reject) => {
      const config = this.symbols.find(cSymbol => cSymbol.symbol === symbol);
      if (!config) {
        this.logger.error(`Bitmex: Invalid leverage config for:${symbol}`);
        resolve(false);

        return;
      }

      // use default leverage to "3"
      const leverageSize = _.get(config, 'extra.bitmex_leverage', 3);

      if (leverageSize < 0 || leverageSize > 100) {
        throw `Invalid leverage size for: ${leverageSize} ${symbol}`;
      }

      // we dont get the selected leverage value in websocket or api endpoints
      // so we update them only in a given time window; system overload is often blocked
      if (symbol in this.leverageUpdated && this.leverageUpdated[symbol] > moment().subtract(45, 'minutes')) {
        this.logger.debug(`Bitmex: leverage update not needed: ${symbol}`);
        resolve(true);
        return;
      }

      const verb = 'POST';
      const path = '/api/v1/position/leverage';
      const expires = new Date().getTime() + 60 * 1000; // 1 min in the future
      const data = {
        symbol: symbol,
        leverage: leverageSize
      };

      const postBody = JSON.stringify(data);
      const signature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(verb + path + expires + postBody)
        .digest('hex');

      const headers = {
        'content-type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'api-expires': expires,
        'api-key': this.apiKey,
        'api-signature': signature
      };

      const me = this;
      request(
        {
          headers: headers,
          url: this.getBaseUrl() + path,
          method: verb,
          body: postBody
        },
        (error, response, body) => {
          if (error) {
            logger.error(`Bitmex: Invalid leverage update request:${JSON.stringify({ error: error, body: body })}`);
            console.error(`Bitmex: Invalid leverage update request:${JSON.stringify({ error: error, body: body })}`);
            resolve(false);

            return;
          }

          const result = JSON.parse(body);
          if (result.error) {
            logger.error(`Bitmex: Invalid leverage update request:${body}`);
            console.error(`Bitmex: Invalid leverage update request:${body}`);
            resolve(false);
            return;
          }

          logger.debug(`Bitmex: Leverage update:${JSON.stringify(symbol)}`);

          // set updated indicator; for not update on next request
          me.leverageUpdated[symbol] = new Date();

          resolve(true);
        }
      );
    });
  }

  cancelOrder(id) {
    const verb = 'DELETE';
    const path = '/api/v1/order';
    const expires = new Date().getTime() + 60 * 1000; // 1 min in the future
    const data = {
      orderID: id,
      text: 'Powered by your awesome crypto-bot watchdog'
    };

    const postBody = JSON.stringify(data);
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(verb + path + expires + postBody)
      .digest('hex');

    const headers = {
      'content-type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'api-expires': expires,
      'api-key': this.apiKey,
      'api-signature': signature
    };

    const { logger } = this;
    const me = this;
    return new Promise(async (resolve, reject) => {
      const result = await this.requestClient.executeRequestRetry(
        {
          headers: headers,
          url: this.getBaseUrl() + path,
          method: verb,
          body: postBody
        },
        result => {
          return result && result.response && result.response.statusCode === 503;
        },
        this.retryOverloadMs,
        this.retryOverloadLimit
      );

      const { error } = result;
      const { body } = result;

      if (error) {
        logger.error(`Bitmex: Invalid cancel order response:${JSON.stringify({ error: error, body: body })}`);
        reject();

        return;
      }

      const orders = JSON.parse(body);

      if (orders.error) {
        logger.error(`Bitmex: Invalid cancel order response:${orders}`);
        reject();
        return;
      }

      logger.info(`Bitmex: Order canceled:${JSON.stringify({ body: body })}`);

      const ourOrders = Bitmex.createOrders(orders);
      ourOrders.forEach(order => {
        me.triggerOrder(order);
      });

      resolve(ourOrders[0]);
    });
  }

  cancelAll(symbol) {
    const verb = 'DELETE';
    const path = '/api/v1/order/all';
    const expires = new Date().getTime() + 60 * 1000; // 1 min in the future
    const data = {
      symbol: symbol,
      text: 'Powered by your awesome crypto-bot watchdog'
    };

    const postBody = JSON.stringify(data);
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(verb + path + expires + postBody)
      .digest('hex');

    const headers = {
      'content-type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'api-expires': expires,
      'api-key': this.apiKey,
      'api-signature': signature
    };

    const { logger } = this;
    const me = this;
    return new Promise(async (resolve, reject) => {
      const result = await this.requestClient.executeRequestRetry(
        {
          headers: headers,
          url: this.getBaseUrl() + path,
          method: verb,
          body: postBody
        },
        result => {
          return result && result.response && result.response.statusCode === 503;
        },
        this.retryOverloadMs,
        this.retryOverloadLimit
      );

      const { error } = result;
      const { body } = result;

      if (error) {
        logger.error(`Bitmex: Invalid cancel all update response:${JSON.stringify({ error: error, body: body })}`);
        reject();

        return;
      }

      const order = JSON.parse(body);

      if (order.error) {
        logger.error(`Bitmex: Invalid order cancel response:${order}`);
        reject();
        return;
      }

      logger.info(`Bitmex: Order canceled: ${JSON.stringify({ body: body })}`);

      const orders = Bitmex.createOrders(order);

      orders.forEach(order => {
        me.triggerOrder(order);
      });
      resolve(orders);
    });
  }

  /**
   * As a websocket fallback update positions also on REST
   */
  async syncPositionViaRestApi() {
    const verb = 'GET';
    const path = '/api/v1/position';
    const expires = new Date().getTime() + 60 * 1000; // 1 min in the future
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(verb + path + expires)
      .digest('hex');

    const headers = {
      'content-type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'api-expires': expires,
      'api-key': this.apiKey,
      'api-signature': signature
    };

    const me = this;

    const result = await this.requestClient.executeRequestRetry(
      {
        headers: headers,
        url: this.getBaseUrl() + path,
        method: verb
      },
      result => {
        return result && result.response && result.response.statusCode === 503;
      },
      this.retryOverloadMs,
      this.retryOverloadLimit
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      me.logger.error(`Bitmex: Invalid position update:${JSON.stringify({ error: error, body: body })}`);
      return;
    }

    me.logger.debug('Bitmex: Positions via API updated');
    me.fullPositionsUpdate(JSON.parse(body));
  }

  /**
   * As a websocket fallback update orders also on REST
   */
  async syncOrdersViaRestApi() {
    const verb = 'GET';
    const path = `/api/v1/order?${querystring.stringify({ filter: JSON.stringify({ open: true }) })}`;
    const expires = new Date().getTime() + 60 * 1000; // 1 min in the future
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(verb + path + expires)
      .digest('hex');

    const headers = {
      'content-type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'api-expires': expires,
      'api-key': this.apiKey,
      'api-signature': signature
    };

    const me = this;

    const result = await this.requestClient.executeRequestRetry(
      {
        headers: headers,
        url: this.getBaseUrl() + path,
        method: verb
      },
      result => {
        return result && result.response && result.response.statusCode === 503;
      },
      this.retryOverloadMs,
      this.retryOverloadLimit
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      me.logger.error(`Bitmex: Invalid orders sync:${JSON.stringify({ error: error, body: body })}`);
      return;
    }

    me.logger.debug('Bitmex: Orders via API updated');

    me.fullOrdersUpdate(JSON.parse(body));
  }

  updateOrder(id, order) {
    if (!order.amount && !order.price) {
      throw 'Invalid amount / price for update';
    }

    const verb = 'PUT';
    const path = '/api/v1/order';
    const expires = new Date().getTime() + 60 * 1000; // 1 min in the future
    const data = {
      orderID: id,
      text: 'Powered by your awesome crypto-bot watchdog'
    };

    if (order.amount) {
      data.orderQty = Math.abs(order.amount);
    }

    // order create needs negative price; order update positive value for "short"
    if (order.price) {
      data.price = Math.abs(order.price);
    }

    const postBody = JSON.stringify(data);
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(verb + path + expires + postBody)
      .digest('hex');

    const headers = {
      'content-type': 'application/json',
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'api-expires': expires,
      'api-key': this.apiKey,
      'api-signature': signature
    };

    const { logger } = this;
    const me = this;
    return new Promise(async (resolve, reject) => {
      const result = await this.requestClient.executeRequestRetry(
        {
          headers: headers,
          url: this.getBaseUrl() + path,
          method: verb,
          body: postBody
        },
        result => {
          return result && result.response && result.response.statusCode === 503;
        },
        this.retryOverloadMs,
        this.retryOverloadLimit
      );

      const { error } = result;
      const { response } = result;
      const { body } = result;

      if (error) {
        logger.error(`Bitmex: Invalid order update response:${JSON.stringify({ error: error, body: body })}`);
        console.error(`Bitmex: Invalid order update response:${JSON.stringify({ error: error, body: body })}`);
        reject();

        return;
      }

      if (!body) {
        logger.error(`Bitmex: Blank order update response${JSON.stringify([response && response.statusCode])}`);
        reject();

        return;
      }

      const order = JSON.parse(body);

      if (order.error) {
        logger.error(`Bitmex: Invalid order created response:${JSON.stringify({ body: body })}`);
        console.error(`Bitmex: Invalid order created response:${JSON.stringify({ body: body })}`);

        reject();
        return;
      }

      logger.info(`Bitmex: Order updated:${JSON.stringify({ body: body })}`);

      const myOrder = Bitmex.createOrders([order])[0];

      me.triggerOrder(myOrder);

      resolve(myOrder);
    });
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
        return position.isOpen === true;
      })
      .map(position => {
        // profit is calculated on ticker
        // this fallback provide the exchange position value and "unleverage" it
        let { unrealisedRoePcnt } = position;

        if (position.leverage && position.leverage > 1) {
          unrealisedRoePcnt /= position.leverage;
        }

        return new Position(
          position.symbol,
          position.currentQty < 0 ? 'short' : 'long',
          position.currentQty,
          parseFloat((unrealisedRoePcnt * 100).toFixed(2)),
          new Date(),
          position.avgEntryPrice,
          new Date(position.openingTimestamp)
        );
      });
  }

  static createOrders(orders) {
    return orders.map(order => {
      let retry = false;

      /*
            match execType with
                | "New" -> `Open, `New_order_accepted
            | "PartiallyFilled" -> `Open, `Partially_filled
            | "Filled" -> `Filled, `Filled
            | "DoneForDay" -> `Open, `General_order_update
            | "Canceled" -> `Canceled, `Canceled
            | "PendingCancel" -> `Pending_cancel, `General_order_update
            | "Stopped" -> `Open, `General_order_update
            | "Rejected" -> `Rejected, `New_order_rejected
            | "PendingNew" -> `Pending_open, `General_order_update
            | "Expired" -> `Rejected, `New_order_rejected
            | _ -> invalid_arg' execType ordStatus
            */

      let status;
      const orderStatus = order.ordStatus.toLowerCase();

      if (['new', 'partiallyfilled', 'pendingnew', 'doneforday', 'stopped'].includes(orderStatus)) {
        status = 'open';
      } else if (orderStatus === 'filled') {
        status = 'done';
      } else if (orderStatus === 'canceled') {
        status = 'canceled';

        // price of order out of ask / bid range from orderbook; we can retry it with updated price
        if (order.execInst.includes('ParticipateDoNotInitiate') && order.text.includes('ParticipateDoNotInitiate')) {
          retry = true;
        }
      } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
        status = 'rejected';
        retry = true;
      }

      const ordType = order.ordType.toLowerCase().replace(/[\W_]+/g, '');

      // secure the value
      let orderType;
      switch (ordType) {
        case 'limit':
          orderType = ExchangeOrder.TYPE_LIMIT;
          break;
        case 'stop':
          orderType = ExchangeOrder.TYPE_STOP;
          break;
        case 'stoplimit':
          orderType = ExchangeOrder.TYPE_STOP_LIMIT;
          break;
        case 'market':
          orderType = ExchangeOrder.TYPE_MARKET;
          break;
        default:
          orderType = ExchangeOrder.TYPE_UNKNOWN;
          break;
      }

      let { price } = order;
      if (orderType === 'stop') {
        price = order.stopPx;
      }

      return new ExchangeOrder(
        order.orderID,
        order.symbol,
        status,
        price,
        order.orderQty,
        retry,
        order.clOrdID,
        order.side.toLowerCase() === 'sell' ? 'sell' : 'buy', // secure the value,
        orderType,
        new Date(order.transactTime),
        new Date(),
        JSON.parse(JSON.stringify(order))
      );
    });
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
    } else if (ourOrderType === Order.TYPE_LIMIT) {
      orderType = 'Limit';
    } else if (ourOrderType === Order.TYPE_STOP) {
      orderType = 'Stop';
    } else if (ourOrderType === Order.TYPE_MARKET) {
      orderType = 'Market';
    }

    if (!orderType) {
      throw 'Invalid order type';
    }

    const body = {
      symbol: order.getSymbol(),
      orderQty: order.getAmount(),
      ordType: orderType,
      text: 'Powered by your awesome crypto-bot watchdog'
    };

    const execInst = [];
    if (order.options && order.options.close === true && orderType === 'Limit') {
      execInst.push('ReduceOnly');
    }

    if (order.options && order.options.close === true && orderType === 'Stop') {
      execInst.push('Close');
    }

    // we need a trigger; else order is filled directly on: "market sell [short]"
    if (orderType === 'Stop') {
      execInst.push('LastPrice');
    }

    if (order.isPostOnly()) {
      execInst.push('ParticipateDoNotInitiate');
    }

    if (execInst.length > 0) {
      body.execInst = execInst.join(',');
    }

    if (orderType === 'Stop') {
      body.stopPx = order.getPrice();
    } else if (orderType === 'Limit') {
      body.price = order.getPrice();
    }

    body.side = order.isShort() ? 'Sell' : 'Buy';

    if (order.getId()) {
      body.clOrdID = order.getId();
    }

    return body;
  }

  getBaseUrl() {
    return 'https://www.bitmex.com';
  }

  isInverseSymbol(symbol) {
    return ['XBTUSD', 'ETHUSD', 'XRPUSD'].includes(symbol) || this.inversedSymboles.includes(symbol);
  }
};
