const BinanceClient = require('binance-api-node').default;

const moment = require('moment');
const _ = require('lodash');
const ExchangeCandlestick = require('../dict/exchange_candlestick');
const Ticker = require('../dict/ticker');
const TickerEvent = require('../event/ticker_event');
const ExchangeOrder = require('../dict/exchange_order');
const OrderUtil = require('../utils/order_util');
const Position = require('../dict/position');
const Order = require('../dict/order');
const OrderBag = require('./utils/order_bag');
const TradesUtil = require('./utils/trades_util');

module.exports = class Binance {
  constructor(eventEmitter, logger, queue, candleImport, throttler) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.queue = queue;
    this.candleImport = candleImport;
    this.throttler = throttler;

    this.client = undefined;
    this.exchangePairs = {};
    this.symbols = [];
    this.trades = {};
    this.tickers = {};
    this.balances = [];
    this.orderbag = new OrderBag();
  }

  start(config, symbols) {
    this.symbols = symbols;

    const opts = {};

    if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
      opts.apiKey = config.key;
      opts.apiSecret = config.secret;
    }

    const client = (this.client = BinanceClient(opts));

    const me = this;

    if (config.key && config.secret) {
      this.client.ws.user(async event => {
        await this.onWebSocketEvent(event);
      });

      // we need balance init; websocket sending only on change
      // also sync by time
      setTimeout(async () => {
        await me.syncPairInfo();
        await me.syncBalances();
        await me.syncOrders();

        // positions needs a ticker price; which needs a websocket event
        setTimeout(async () => {
          const initSymbols = (await me.getPositions()).map(p => p.getSymbol());
          me.logger.info(`Binance: init trades for positions: ${JSON.stringify(initSymbols)}`);
          await me.syncTradesForEntries(initSymbols);
        }, 12312);
      }, 1823);

      setInterval(async () => {
        await me.syncBalances();
      }, 5 * 60 * 1312);

      setInterval(async () => {
        await me.syncTradesForEntries();
      }, 16 * 60 * 1391);

      setInterval(async () => {
        await me.syncOrders();
      }, 30 * 1310);

      setInterval(async () => {
        await me.syncPairInfo();
      }, 30 * 60 * 1532);
    } else {
      this.logger.info('Binance: Starting as anonymous; no trading possible');
    }

    let tickersToOpen = 0;
    const { eventEmitter } = this;
    symbols.forEach(symbol => {
      // live prices
      client.ws.ticker(symbol.symbol, ticker => {
        eventEmitter.emit(
          'ticker',
          new TickerEvent(
            'binance',
            symbol.symbol,
            (this.tickers[symbol.symbol] = new Ticker('binance', symbol.symbol, moment().format('X'), ticker.bestBid, ticker.bestAsk))
          )
        );
      });

      symbol.periods.forEach(interval => {
        // backfill
        this.queue.add(() => {
          client.candles({ symbol: symbol.symbol, limit: 500, interval: interval }).then(async candles => {
            const ourCandles = candles.map(
              candle =>
                new ExchangeCandlestick(
                  'binance',
                  symbol.symbol,
                  interval,
                  Math.round(candle.openTime / 1000),
                  candle.open,
                  candle.high,
                  candle.low,
                  candle.close,
                  candle.volume
                )
            );

            await this.candleImport.insertThrottledCandles(ourCandles);
          });
        });

        // live candles
        tickersToOpen++;
        if (tickersToOpen < 200) {
          setTimeout(() => {
            client.ws.candles(symbol.symbol, interval, async candle => {
              const ourCandle = new ExchangeCandlestick(
                'binance',
                symbol.symbol,
                interval,
                Math.round(candle.startTime / 1000),
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume
              );

              await this.candleImport.insertThrottledCandles([ourCandle]);
            });
          }, 200 * tickersToOpen);
        } else {
          this.logger.info(`Binance: Too many tickers for websocket skipping: ${symbol.symbol} - ${interval}`);
        }
      });
    });

    this.logger.info(`Binance: Websocket tickers to open: ${tickersToOpen}`);
  }

  async order(order) {
    const payload = Binance.createOrderBody(order);
    let result;

    try {
      result = await this.client.order(payload);
    } catch (e) {
      this.logger.error(`Binance: order create error: ${JSON.stringify(e.code, e.message, order, payload)}`);

      if ((e.message && e.message.toLowerCase().includes('insufficient balance')) || (e.code && e.code === -2010)) {
        return ExchangeOrder.createRejectedFromOrder(order, `${e.code} - ${e.message}`);
      }

      return undefined;
    }

    const exchangeOrder = Binance.createOrders(result)[0];
    this.triggerOrder(exchangeOrder);
    return exchangeOrder;
  }

  async cancelOrder(id) {
    const order = await this.findOrderById(id);
    if (!order) {
      return undefined;
    }

    try {
      await this.client.cancelOrder({
        symbol: order.symbol,
        orderId: id
      });
    } catch (e) {
      const message = String(e).toLowerCase();

      // "Error: Unknown order sent."
      if (message.includes('unknown order sent')) {
        this.logger.info(`Binance: cancel order not found remove it: ${JSON.stringify([e, id])}`);
        this.orderbag.delete(id);
        return ExchangeOrder.createCanceled(order);
      }

      this.logger.error(`Binance: cancel order error: ${JSON.stringify([e, id])}`);

      return undefined;
    }

    this.orderbag.delete(id);

    return ExchangeOrder.createCanceled(order);
  }

  async cancelAll(symbol) {
    const orders = [];

    for (const order of await this.getOrdersForSymbol(symbol)) {
      orders.push(await this.cancelOrder(order.id));
    }

    return orders;
  }

  static createOrderBody(order) {
    if (!order.getAmount() && !order.getPrice() && !order.getSymbol()) {
      throw Error('Invalid amount for update');
    }

    const myOrder = {
      symbol: order.getSymbol(),
      side: order.isShort() ? 'SELL' : 'BUY',
      quantity: order.getAmount()
    };

    let orderType;
    const type = order.getType();
    if (!type || type === 'limit') {
      orderType = 'LIMIT';
      myOrder.price = order.getPrice();
    } else if (type === 'stop') {
      orderType = 'STOP_LOSS';
      myOrder.stopPrice = order.getPrice();
    } else if (type === 'market') {
      orderType = 'MARKET';
    }

    if (!orderType) {
      throw Error('Invalid order type');
    }

    myOrder.type = orderType;

    if (order.id) {
      myOrder.newClientOrderId = order.getId();
    }

    return myOrder;
  }

  static createOrders(...orders) {
    return orders.map(order => {
      let retry = false;

      let status;

      let sourceStatus;
      if (order.status) {
        sourceStatus = order.status; // REST
      } else if (order.orderStatus) {
        sourceStatus = order.orderStatus; // websocket
      } else {
        throw new Error(`Invalid order status: ${JSON.stringify(order)}`);
      }

      const orderStatus = sourceStatus.toLowerCase().replace('_', '');

      // https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md#enum-definitions
      if (['new', 'partiallyfilled', 'pendingnew'].includes(orderStatus)) {
        status = 'open';
      } else if (orderStatus === 'filled') {
        status = 'done';
      } else if (orderStatus === 'canceled') {
        status = 'canceled';
      } else if (orderStatus === 'rejected') {
        status = 'rejected';
        retry = false;
      } else if (orderStatus === 'expired') {
        status = 'rejected';
        retry = true;
      }

      let sourceOrderStatus;
      if (order.type) {
        sourceOrderStatus = order.type; // REST
      } else if (order.orderType) {
        sourceOrderStatus = order.orderType; // websocket
      } else {
        throw new Error(`Invalid order type: ${JSON.stringify(order)}`);
      }

      const ordType = sourceOrderStatus.toLowerCase().replace(/[\W_]+/g, '');

      // secure the value
      let orderType;
      switch (ordType) {
        case 'limit':
          orderType = ExchangeOrder.TYPE_LIMIT;
          break;
        case 'stoploss':
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

      let amount;
      if (order.origQty) {
        amount = order.origQty; // REST
      } else if (order.quantity) {
        amount = order.quantity; // websocket
      } else {
        throw new Error(`Invalid order amount: ${JSON.stringify(order)}`);
      }

      if (order.totalTradeQuantity) {
        // websocket
        const totalTradeQuantity = parseFloat(order.totalTradeQuantity);
        if (totalTradeQuantity > 0) {
          amount -= totalTradeQuantity;
        }
      } else if (order.executedQty) {
        // REST
        const executedQty = parseFloat(order.executedQty);
        if (executedQty > 0) {
          amount -= executedQty;
        }
      }

      if (amount < 0) {
        throw new Error(`Invalid order amount: ${JSON.stringify(amount, order)}`);
      }

      let clientOrderId;
      if (order.clientOrderId) {
        clientOrderId = order.clientOrderId; // REST
      } else if (order.newClientOrderId) {
        clientOrderId = order.newClientOrderId; // websocket
      }

      let createdAt;
      if (order.transactTime) {
        createdAt = order.transactTime; // REST
      } else if (order.time) {
        createdAt = order.time; // REST
      } else if (order.creationTime) {
        createdAt = order.creationTime; // websocket
      }

      // secure the value
      const side = order.side.toLowerCase();
      if (!['buy', 'sell'].includes(side)) {
        throw new Error(`Invalid order side: ${JSON.stringify(order)}`);
      }

      return new ExchangeOrder(
        order.orderId,
        order.symbol,
        status,
        parseFloat(order.price),
        parseFloat(amount),
        retry,
        clientOrderId,
        side,
        orderType,
        createdAt ? new Date(createdAt) : undefined,
        new Date(),
        order
      );
    });
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order) {
    return this.orderbag.triggerOrder(order);
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
    const positions = [];

    // get pairs with capital to fake open positions
    const capitals = {};
    this.symbols
      .filter(
        s =>
          s.trade &&
          ((s.trade.capital && s.trade.capital > 0) ||
            (s.trade.currency_capital && s.trade.currency_capital > 0) ||
            (s.trade.strategies && s.trade.strategies.length > 0))
      )
      .forEach(s => {
        if (s.trade.capital > 0) {
          capitals[s.symbol] = s.trade.capital;
        } else if (s.trade.currency_capital > 0 && this.tickers[s.symbol] && this.tickers[s.symbol].bid) {
          capitals[s.symbol] = s.trade.currency_capital / this.tickers[s.symbol].bid;
        } else {
          capitals[s.symbol] = 0;
        }
      });

    for (const balance of this.balances) {
      const { asset } = balance;

      const assetPositions = [];

      for (const pair in capitals) {
        // just a hack to get matching pairs with capital eg: "BTCUSDT" needs a capital of "BTC"
        // workaround: eg "BTCUPDOWN" is breaking the match
        if (!pair.startsWith(asset) || pair.startsWith(`${asset}UP`) || pair.startsWith(`${asset}DOWN`)) {
          continue;
        }

        // 1% balance left indicate open position
        const pairCapital = capitals[pair];
        if (Math.abs(Math.abs(balance.available) / pairCapital) < 0.1) {
          continue;
        }

        let entry;
        let createdAt;

        // try to find a entry price, based on trade history
        const side = balance.available < 0 ? 'short' : 'long';

        const trades = this.trades[pair];
        if (trades && trades.length > 0) {
          const positionEntry = TradesUtil.findPositionEntryFromTrades(trades, Math.abs(balance.available), side);

          if (positionEntry) {
            entry = positionEntry.average_price;
            createdAt = positionEntry.time;
          }
        }

        // calculate profit based on the ticker price
        let profit;
        if (entry && this.tickers[pair]) {
          profit = (this.tickers[pair].bid / entry - 1) * 100;

          // inverse profit for short
          if (side === 'short') {
            profit *= -1;
          }
        }

        assetPositions.push(Position.create(pair, balance.available, new Date(), createdAt, entry, profit));
      }

      if (assetPositions.length > 0) {
        // on multiple pair path orders with latest date wins
        const assetPositionsOrdered = assetPositions.sort(
          // order by latest
          (a, b) => (b.createdAt ? b.createdAt : new Date('1970-01-01')) - (a.createdAt ? a.createdAt : new Date('1970-01-01'))
        );

        positions.push(assetPositionsOrdered[0]);
      }
    }

    return positions;
  }

  async getPositionForSymbol(symbol) {
    return (await this.getPositions()).find(position => position.symbol === symbol);
  }

  async updateOrder(id, order) {
    if (!order.amount && !order.price) {
      throw new Error('Invalid amount / price for update');
    }

    const currentOrder = await this.findOrderById(id);
    if (!currentOrder) {
      return undefined;
    }

    // cancel order; mostly it can already be canceled
    await this.cancelOrder(id);

    return this.order(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount));
  }

  getName() {
    return 'binance';
  }

  async onWebSocketEvent(event) {
    if (event.eventType && event.eventType === 'executionReport' && ('orderStatus' in event || 'orderId' in event)) {
      this.logger.debug(`Binance: Got executionReport order event: ${JSON.stringify(event)}`);

      // clean orders with state is switching from open to close
      const orderStatus = event.orderStatus.toLowerCase();
      const isRemoveEvent = ['canceled', 'filled', 'rejected'].includes(orderStatus) && event.orderId && this.orderbag.get(event.orderId);

      if (isRemoveEvent) {
        this.logger.info(`Binance: Removing non open order: ${orderStatus} - ${JSON.stringify(event)}`);
        this.orderbag.delete(event.orderId);
        this.throttler.addTask('binance_sync_balances', this.syncBalances.bind(this), 5000);
      }

      // sync all open orders and get entry based fire them in parallel
      this.throttler.addTask('binance_sync_orders', this.syncOrders.bind(this));

      // set last order price to our trades. so we have directly profit and entry prices
      this.throttler.addTask(
        `binance_sync_trades_for_entries_${event.symbol}`,
        async () => {
          await this.syncTradesForEntries([event.symbol]);
        },
        300
      );

      if ('orderId' in event) {
        const exchangeOrder = Binance.createOrders(event)[0];
        this.orderbag.triggerOrder(exchangeOrder);
      }
    }

    // force balance update via api because:
    // - "account": old api (once full update)
    // - "outboundAccountPosition" given only delta
    // - "balanceUpdate" given not balances
    if (event.eventType && ['outboundAccountPosition', 'account', 'balanceUpdate'].includes(event.eventType)) {
      this.throttler.addTask('binance_sync_balances', this.syncBalances.bind(this), 300);
    }
  }

  async syncOrders() {
    const symbols = this.symbols
      .filter(s => s.trade && ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0)))
      .map(s => s.symbol);

    this.logger.debug(`Binance: Sync orders for symbols: ${symbols.length}`);

    // false equal to all symbols
    let openOrders = [];
    try {
      openOrders = await this.client.openOrders(false);
    } catch (e) {
      this.logger.error(`Binance: error sync orders: ${String(e)}`);
      return;
    }

    this.orderbag.set(Binance.createOrders(...openOrders));
  }

  async syncBalances() {
    let accountInfo;
    try {
      accountInfo = await this.client.accountInfo();
    } catch (e) {
      this.logger.error(`Binance: error sync balances: ${String(e)}`);
      return;
    }

    if (!accountInfo || !accountInfo.balances) {
      return;
    }

    this.logger.debug('Binance: Sync balances');

    this.balances = accountInfo.balances
      .filter(b => parseFloat(b.free) + parseFloat(b.locked) > 0)
      .map(balance => ({
        available: parseFloat(balance.free) + parseFloat(balance.locked),
        locked: parseFloat(balance.locked),
        asset: balance.asset
      }));
  }

  /**
   * Binance does not have position trading, but we need entry price so fetch them from filled order history
   *
   * @param symbols
   * @returns {Promise<void>}
   */
  async syncTradesForEntries(symbols = []) {
    // fetch all based on our allowed symbol capital
    if (symbols.length === 0) {
      const allSymbols = this.symbols
        .filter(s => s.trade && ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0)))
        .map(s => s.symbol);

      // we need position first and randomly add other
      const positionSymbols = _.shuffle((await this.getPositions()).map(p => p.getSymbol()));
      const unknown = _.shuffle(allSymbols).filter(s => !positionSymbols.includes(s));

      positionSymbols.push(...unknown);

      symbols = positionSymbols;
    }

    this.logger.debug(`Binance: Sync trades for entries: ${symbols.length} - ${JSON.stringify(symbols)}`);

    const promises = symbols.map(symbol => async () => {
      let symbolOrders;

      try {
        symbolOrders = await this.client.allOrders({
          symbol: symbol,
          limit: 10
        });
      } catch (e) {
        this.logger.info(`Binance: Sync trades error for entries: ${symbol} - ${String(e)}`);
        return undefined;
      }

      const orders = symbolOrders
        .filter(
          // filled order and fully closed but be have also partially_filled ones if ordering was no fully done
          // in case order was canceled but executedQty is set we have a partially cancel
          order =>
            ['filled', 'partially_filled'].includes(order.status.toLowerCase()) ||
            (order.status.toLowerCase() === 'canceled' && parseFloat(order.executedQty) > 0)
        )
        .sort(
          // order by latest
          (a, b) => b.time - a.time
        )
        .map(order => {
          let price = parseFloat(order.price);

          // market order is not having price info, we need to calulcate it
          if (price === 0 && order.type && order.type.toLowerCase() === 'market') {
            const executedQty = parseFloat(order.executedQty);
            const cummulativeQuoteQty = parseFloat(order.cummulativeQuoteQty);

            if (cummulativeQuoteQty !== 0 && executedQty !== 0) {
              price = cummulativeQuoteQty / executedQty;
            }
          }

          return {
            side: order.side.toLowerCase(),
            price: price,
            symbol: order.symbol,
            time: new Date(order.time),
            size: parseFloat(order.executedQty)
          };
        });

      return { symbol: symbol, orders: orders };
    });

    // no queue for trigger; its timing relevant
    if (promises.length === 1) {
      const result = await promises[0]();
      if (result) {
        this.trades[result.symbol] = result.orders;
      }

      return;
    }

    // add to queue
    promises.forEach(p => {
      this.queue.addQueue3(async () => {
        const result = await p();
        if (result) {
          this.trades[result.symbol] = result.orders;
        }
      });
    });
  }

  async syncPairInfo() {
    const pairs = await this.client.exchangeInfo();
    if (!pairs.symbols) {
      return;
    }

    const exchangePairs = {};
    pairs.symbols.forEach(pair => {
      const pairInfo = {};

      const priceFilter = pair.filters.find(f => f.filterType === 'PRICE_FILTER');
      if (priceFilter) {
        pairInfo.tick_size = parseFloat(priceFilter.tickSize);
      }

      const lotSize = pair.filters.find(f => f.filterType === 'LOT_SIZE');
      if (priceFilter) {
        pairInfo.lot_size = parseFloat(lotSize.stepSize);
      }

      exchangePairs[pair.symbol] = pairInfo;
    });

    this.logger.info(`Binance: pairs synced: ${pairs.symbols.length}`);
    this.exchangePairs = exchangePairs;
  }

  isInverseSymbol(symbol) {
    return false;
  }
};
