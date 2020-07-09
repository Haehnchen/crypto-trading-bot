const WebSocket = require('ws');
const ccxt = require('ccxt');
const moment = require('moment');
const Ticker = require('../dict/ticker');
const Order = require('../dict/order');
const TickerEvent = require('../event/ticker_event');
const ExchangeCandlestick = require('../dict/exchange_candlestick');
const Position = require('../dict/position');
const CcxtExchangeOrder = require('./ccxt/ccxt_exchange_order');

module.exports = class BinanceFutures {
  constructor(eventEmitter, requestClient, candlestickResample, logger, queue, candleImporter) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.queue = queue;
    this.candleImporter = candleImporter;
    this.exchange = null;

    this.ccxtExchangeOrder = undefined;

    this.positions = {};
    this.orders = {};
    this.tickers = {};
    this.symbols = [];
    this.intervals = [];
    this.ccxtClient = undefined;
  }

  start(config, symbols) {
    const { logger } = this;
    this.exchange = null;

    const ccxtClient = (this.ccxtClient = new ccxt.binance({
      apiKey: config.key,
      secret: config.secret,
      options: { defaultType: 'future', warnOnFetchOpenOrdersWithoutSymbol: false }
    }));

    this.intervals = [];

    this.symbols = symbols;
    this.positions = {};
    this.orders = {};
    this.ccxtExchangeOrder = BinanceFutures.createCustomCcxtOrderInstance(ccxtClient, symbols, logger);

    const me = this;

    if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
      setInterval(async () => {
        await me.ccxtExchangeOrder.syncOrders();
      }, 1000 * 30);

      setInterval(async () => {
        await me.syncPositionViaRestApi();
      }, 1000 * 36);

      setTimeout(async () => {
        await ccxtClient.fetchMarkets();
        await me.ccxtExchangeOrder.syncOrders();
        await me.syncPositionViaRestApi();
      }, 1000);

      setTimeout(async () => {
        await me.initUserWebsocket();
      }, 2000);

      setTimeout(async () => {
        await me.initPublicWebsocket(symbols, config);
      }, 5000);
    } else {
      me.logger.info('Binance Futures: Starting as anonymous; no trading possible');
    }

    symbols.forEach(symbol => {
      symbol.periods.forEach(period => {
        // for bot init prefill data: load latest candles from api
        this.queue.add(async () => {
          let ohlcvs;

          try {
            ohlcvs = await ccxtClient.fetchOHLCV(symbol.symbol.replace('USDT', '/USDT'), period, undefined, 500);
          } catch (e) {
            me.logger.info(
              `Binance Futures: candles fetch error: ${JSON.stringify([symbol.symbol, period, String(e)])}`
            );

            return;
          }

          const ourCandles = ohlcvs.map(candle => {
            return new ExchangeCandlestick(
              me.getName(),
              symbol.symbol,
              period,
              Math.round(candle[0] / 1000),
              candle[1],
              candle[2],
              candle[3],
              candle[4],
              candle[5]
            );
          });

          await me.candleImporter.insertThrottledCandles(ourCandles);
        });
      });
    });
  }

  /**
   * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
   *
   * @param positions Position
   */
  fullPositionsUpdate(positions) {
    const currentPositions = {};

    positions.forEach(position => {
      currentPositions[position.symbol] = position;
    });

    this.positions = currentPositions;
  }

  async getOrders() {
    return this.ccxtExchangeOrder.getOrders();
  }

  async findOrderById(id) {
    return this.ccxtExchangeOrder.findOrderById(id);
  }

  async getOrdersForSymbol(symbol) {
    return this.ccxtExchangeOrder.getOrdersForSymbol(symbol);
  }

  async getPositions() {
    return Object.values(this.positions).map(position => {
      // overwrite profits by ticker price from position; ticker prices are more fresh
      if (position.getEntry() && this.tickers[position.getSymbol()]) {
        const profit = position.isLong()
          ? (this.tickers[position.symbol].bid / position.entry - 1) * 100 // long profit
          : (position.entry / this.tickers[position.symbol].ask - 1) * 100; // short profit

        return Position.createProfitUpdate(position, profit);
      }

      return position;
    });
  }

  async getPositionForSymbol(symbol) {
    return (await this.getPositions()).find(position => position.symbol === symbol);
  }

  calculatePrice(price, symbol) {
    return price; // done by ccxt
  }

  calculateAmount(amount, symbol) {
    return amount; // done by ccxt
  }

  getName() {
    return 'binance_futures';
  }

  async order(order) {
    return this.ccxtExchangeOrder.createOrder(order);
  }

  async cancelOrder(id) {
    const result = this.ccxtExchangeOrder.cancelOrder(id);
    await this.ccxtExchangeOrder.syncOrders();
    return result;
  }

  async cancelAll(symbol) {
    const result = this.ccxtExchangeOrder.cancelAll(symbol);
    await this.ccxtExchangeOrder.syncOrders();
    return result;
  }

  async updateOrder(id, order) {
    if (!order.amount && !order.price) {
      throw new Error('Invalid amount / price for update');
    }

    const result = this.ccxtExchangeOrder.updateOrder(id, order);
    await this.ccxtExchangeOrder.syncOrders();
    return result;
  }

  /**
   * Convert incoming positions only if they are open
   *
   * @param positions
   * @returns {*}
   */
  static createPositions(positions) {
    return positions.map(position => {
      const positionAmt = parseFloat(position.positionAmt);

      const entryPrice = parseFloat(position.entryPrice);
      const markPrice = parseFloat(position.markPrice);

      const profit =
        positionAmt < 0
          ? (entryPrice / markPrice - 1) * 100 // short
          : (markPrice / entryPrice - 1) * 100; // long

      return new Position(
        position.symbol,
        positionAmt < 0 ? 'short' : 'long',
        positionAmt,
        parseFloat(profit.toFixed(2)), // round 2 numbers
        new Date(),
        entryPrice,
        undefined,
        position
      );
    });
  }

  /**
   * Convert incoming position only if they are open
   *
   * @param position
   * @returns {*}
   */
  static createPositionFromWebsocket(position) {
    const positionAmt = parseFloat(position.pa);
    const entryPrice = parseFloat(position.ep);

    return new Position(
      position.s,
      positionAmt < 0 ? 'short' : 'long',
      positionAmt,
      undefined,
      new Date(),
      entryPrice,
      undefined,
      position
    );
  }

  /**
   * Websocket position updates
   */
  accountUpdate(message) {
    if (message.a && message.a.P) {
      message.a.P.forEach(position => {
        if (!position.s) {
          return;
        }

        // position closed
        if (position.s in this.positions && position.pa === '0') {
          delete this.positions[position.s];

          this.logger.info(
            `Binance Futures: Websocket position closed/removed: ${JSON.stringify([position.s, position])}`
          );
        }

        // position open
        if (
          !(position.s in this.positions) &&
          position.pa !== '0' &&
          (parseFloat(position.ep) > 0.00001 || parseFloat(position.ep) < -0.00001) // prevent float point issues
        ) {
          this.positions[position.s] = BinanceFutures.createPositionFromWebsocket(position);

          this.logger.info(`Binance Futures: Websocket position new found: ${JSON.stringify([position.s, position])}`);
        }
      }, this);
    }
  }

  /**
   * As a websocket fallback update orders also on REST
   */
  async syncPositionViaRestApi() {
    let response;
    try {
      response = await this.ccxtClient.fapiPrivateGetPositionRisk();
    } catch (e) {
      this.logger.error(`Binance Futures: error getting positions:${e}`);
      return;
    }

    const positions = response.filter(position => position.entryPrice && parseFloat(position.entryPrice) > 0);
    this.fullPositionsUpdate(BinanceFutures.createPositions(positions));

    this.logger.debug(`Binance Futures: positions updates: ${positions.length}`);
  }

  isInverseSymbol(symbol) {
    return false;
  }

  async initPublicWebsocket(symbols, config) {
    const me = this;
    const ws = new WebSocket('wss://fstream.binance.com/stream');

    ws.onerror = function(e) {
      me.logger.info(`Binance Futures: Public stream error: ${String(e)}`);
    };

    ws.onopen = function() {
      me.logger.info('Binance Futures: Public stream opened.');

      // we are only allowed to send a websocket every 5 sec; wait for some init stuff and then run it
      setTimeout(() => {
        symbols.forEach((symbol, index) => {
          // we are only allowed to send a request every 5 seconds
          setTimeout(() => {
            const params = [
              `${symbol.symbol.toLowerCase()}@bookTicker`,
              ...symbol.periods.map(p => `${symbol.symbol.toLowerCase()}@kline_${p}`)
            ];

            me.logger.debug(`Binance Futures: Public stream subscribing: ${JSON.stringify([symbol.symbol, params])}`);

            ws.send(
              JSON.stringify({
                method: 'SUBSCRIBE',
                params: params,
                id: Math.floor(Math.random() * Math.floor(100))
              })
            );
          }, (index + 1) * 5500);
        });
      }, 10000);
    };

    ws.onmessage = async function(event) {
      if (event.type && event.type === 'message') {
        const body = JSON.parse(event.data);

        if (body.stream && body.stream.toLowerCase().includes('@bookticker')) {
          me.eventEmitter.emit(
            'ticker',
            new TickerEvent(
              me.getName(),
              body.data.s,
              (me.tickers[body.data.s] = new Ticker(
                me.getName(),
                body.data.s,
                moment().format('X'),
                parseFloat(body.data.b),
                parseFloat(body.data.a)
              ))
            )
          );
        } else if (body.stream && body.stream.toLowerCase().includes('@kline')) {
          await me.candleImporter.insertThrottledCandles([
            new ExchangeCandlestick(
              me.getName(),
              body.data.s,
              body.data.k.i,
              Math.round(body.data.k.t / 1000),
              parseFloat(body.data.k.o),
              parseFloat(body.data.k.h),
              parseFloat(body.data.k.l),
              parseFloat(body.data.k.c),
              parseFloat(body.data.k.v)
            )
          ]);
        }
      }
    };

    ws.onclose = function() {
      me.logger.info('Binance futures: Public stream connection closed.');

      setTimeout(async () => {
        me.logger.info('Binance futures: Public stream connection reconnect');
        await me.initPublicWebsocket(symbols, config);
      }, 1000 * 30);
    };
  }

  async initUserWebsocket() {
    let response;
    try {
      response = await this.ccxtClient.fapiPrivatePostListenKey();
    } catch (e) {
      this.logger.error(`Binance Futures: listenKey error: ${String(e)}`);
      return undefined;
    }

    if (!response || !response.listenKey) {
      this.logger.error(`Binance Futures: invalid listenKey response: ${JSON.stringify(response)}`);
      return undefined;
    }

    const me = this;
    const ws = new WebSocket(`wss://fstream.binance.com/ws/${response.listenKey}`);
    ws.onerror = function(e) {
      me.logger.info(`Binance Futures: Connection error: ${String(e)}`);
    };

    ws.onopen = function() {
      me.logger.info(`Binance Futures: Opened user stream`);
    };

    ws.onmessage = async function(event) {
      if (event && event.type === 'message') {
        const message = JSON.parse(event.data);

        if (message.e && message.e.toUpperCase() === 'ORDER_TRADE_UPDATE') {
          const order = message.o;

          const remapp = {
            s: 'symbol',
            c: 'clientOrderId',
            S: 'side',
            o: 'type',
            f: 'timeInForce',
            q: 'origQty',
            p: 'price',
            sp: 'stopPrice',
            X: 'status',
            i: 'orderId',
            T: 'updateTime'
          };

          Object.keys(order).forEach(k => {
            if (remapp[k]) {
              order[remapp[k]] = order[k];
            }
          });

          me.ccxtExchangeOrder.triggerPlainOrder(order);
        }

        if (message.e && message.e.toUpperCase() === 'ACCOUNT_UPDATE') {
          console.log(JSON.stringify(message, null, 4));
          me.accountUpdate(message);
          await me.syncPositionViaRestApi();
        }
      }
    };

    const heartbeat = setInterval(async () => {
      try {
        await this.ccxtClient.fapiPrivatePutListenKey();
        this.logger.debug('Binance Futures: user stream ping successfully done');
      } catch (e) {
        this.logger.error(`Binance Futures: user stream ping error: ${String(e)}`);
      }
    }, 1000 * 60 * 10);

    ws.onclose = function() {
      me.logger.info('Binance futures: User stream connection closed.');
      clearInterval(heartbeat);

      setTimeout(async () => {
        me.logger.info('Binance futures: User stream connection reconnect');
        await me.initUserWebsocket();
      }, 1000 * 30);
    };

    return true;
  }

  static createCustomCcxtOrderInstance(ccxtClient, symbols, logger) {
    // ccxt id and binance ids are not matching
    const CcxtExchangeOrderExtends = class extends CcxtExchangeOrder {
      async createOrder(order) {
        order.symbol = order.symbol.replace('USDT', '/USDT');
        return super.createOrder(order);
      }

      async syncOrders() {
        const orders = await super.syncOrders();

        if (Array.isArray(orders)) {
          orders.forEach(order => {
            order.symbol = order.symbol.replace('/USDT', 'USDT');
          });
        }

        return orders;
      }
    };

    return new CcxtExchangeOrderExtends(ccxtClient, symbols, logger, {
      cancelOrder: (client, args) => {
        return { symbol: args.symbol.replace('USDT', '/USDT') };
      },
      convertOrder: (client, order) => {
        order.symbol = order.symbol.replace('/USDT', 'USDT');
      },
      createOrder: order => {
        const request = {
          args: {}
        };

        if (order.isReduceOnly()) {
          request.args.reduceOnly = true;
        }

        if (order.getType() === Order.TYPE_STOP) {
          request.args.stopPrice = order.getPrice();
        }

        return request;
      }
    });
  }
};
