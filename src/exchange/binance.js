const BinanceClient = require('binance-api-node').default;

const moment = require('moment');
const ExchangeCandlestick = require('./../dict/exchange_candlestick');
const Ticker = require('./../dict/ticker');
const TickerEvent = require('./../event/ticker_event');
const ExchangeOrder = require('../dict/exchange_order');
const OrderUtil = require('../utils/order_util');
const Position = require('../dict/position');
const Order = require('../dict/order');
const OrderBag = require('./utils/order_bag');
const TradesUtil = require('./utils/trades_util');

module.exports = class Binance {
  constructor(eventEmitter, logger, queue, candleImport) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.queue = queue;
    this.candleImport = candleImport;

    this.client = undefined;
    this.exchangePairs = {};
    this.symbols = [];
    this.positions = [];
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
      setInterval(
        (function f() {
          me.syncBalances();
          return f;
        })(),
        60 * 60 * 1 * 1000
      );

      setInterval(
        (function f() {
          me.syncTradesForEntries();
          return f;
        })(),
        60 * 60 * 1 * 1000
      );

      setInterval(
        (function f() {
          me.syncOrders();
          return f;
        })(),
        1000 * 30
      );

      // since pairs
      setInterval(
        (function f() {
          me.syncPairInfo();
          return f;
        })(),
        60 * 60 * 15 * 1000
      );
    } else {
      this.logger.info('Binance: Starting as anonymous; no trading possible');
    }

    const { eventEmitter } = this;
    symbols.forEach(symbol => {
      // live prices
      client.ws.ticker(symbol.symbol, ticker => {
        eventEmitter.emit(
          'ticker',
          new TickerEvent(
            'binance',
            symbol.symbol,
            (this.tickers[symbol.symbol] = new Ticker(
              'binance',
              symbol.symbol,
              moment().format('X'),
              ticker.bestBid,
              ticker.bestAsk
            ))
          )
        );
      });

      symbol.periods.forEach(interval => {
        // backfill
        this.queue.add(() => {
          client.candles({ symbol: symbol.symbol, limit: 500, interval: interval }).then(async candles => {
            const ourCandles = candles.map(candle => {
              return new ExchangeCandlestick(
                'binance',
                symbol.symbol,
                interval,
                Math.round(candle.openTime / 1000),
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume
              );
            });

            await this.candleImport.insertThrottledCandles(ourCandles);
          });
        });

        // live candles
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
      });
    });
  }

  async order(order) {
    const payload = Binance.createOrderBody(order);
    let result;

    try {
      result = await this.client.order(payload);
    } catch (e) {
      this.logger.error(`Binance: order create error: ${JSON.stringify(e.message, order, payload)}`);

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
      return;
    }

    try {
      await this.client.cancelOrder({
        symbol: order.symbol,
        orderId: id
      });
    } catch (e) {
      this.logger.error(`Binance: cancel order error: ${e}`);
      return;
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
      const orderStatus = order.status.toLowerCase().replace('_', '');

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

      const ordType = order.type.toLowerCase().replace(/[\W_]+/g, '');

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

      return new ExchangeOrder(
        order.orderId,
        order.symbol,
        status,
        parseFloat(order.price),
        parseFloat(order.origQty),
        retry,
        order.clientOrderId,
        order.side.toLowerCase() === 'buy' ? 'buy' : 'sell', // secure the value,
        orderType,
        new Date(order.transactTime ? order.transactTime : order.time),
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
          ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0))
      )
      .forEach(s => {
        if (s.trade.capital > 0) {
          capitals[s.symbol] = s.trade.capital;
        } else if (s.trade.currency_capital > 0 && this.tickers[s.symbol] && this.tickers[s.symbol].bid) {
          capitals[s.symbol] = s.trade.currency_capital / this.tickers[s.symbol].bid;
        }
      });

    for (const balance of this.balances) {
      const { asset } = balance;

      const assetPositions = [];

      for (const pair in capitals) {
        // just a hack to get matching pairs with capital eg: "BTCUSDT" needs a capital of "BTC"
        if (!pair.startsWith(asset)) {
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
          (a, b) =>
            (b.createdAt ? b.createdAt : new Date('1970-01-01')) - (a.createdAt ? a.createdAt : new Date('1970-01-01'))
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

  getName() {
    return 'binance';
  }

  async onWebSocketEvent(event) {
    if (event.eventType && event.eventType === 'executionReport' && ('orderStatus' in event || 'orderId' in event)) {
      this.logger.debug(`Binance: Got executionReport order event: ${JSON.stringify(event)}`);

      // clean orders with state is switching from open to close
      const orderStatus = event.orderStatus.toLowerCase();
      if (
        ['canceled', 'filled', 'rejected'].includes(orderStatus) &&
        event.orderId &&
        this.orderbag.get(event.orderId)
      ) {
        this.orderbag.delete(event.orderId);
      }

      // sync all open orders and get entry based fire them in parallel
      await this.syncOrders();

      // set last order price to our trades. so we have directly profit and entry prices
      await this.syncTradesForEntries([event.symbol]);
    }

    // get balances and same them internally; allows to take open positions
    // Format we get: balances: {'EOS': {"available": 12, "locked": 8}}
    if (event.eventType && event.eventType === 'account' && 'balances' in event) {
      const balances = [];

      for (const asset in event.balances) {
        const balance = event.balances[asset];

        if (parseFloat(balance.available) + parseFloat(balance.locked) > 0) {
          balances.push({
            available: parseFloat(balance.available),
            locked: parseFloat(balance.locked),
            asset: asset
          });
        }
      }

      this.balances = balances;
    }
  }

  async syncOrders() {
    const symbols = this.symbols
      .filter(
        s =>
          s.trade &&
          ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0))
      )
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
      .map(balance => {
        return {
          available: parseFloat(balance.free),
          locked: parseFloat(balance.locked),
          asset: balance.asset
        };
      });
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
      symbols = this.symbols
        .filter(
          s =>
            s.trade &&
            ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0))
        )
        .map(s => s.symbol);
    }

    this.logger.debug(`Binance: Sync trades for entries: ${symbols.length}`);

    const promises = symbols.map(symbol => {
      return new Promise(async resolve => {
        let symbolOrders;

        try {
          symbolOrders = await this.client.allOrders({
            symbol: symbol,
            limit: 10
          });
        } catch (e) {
          this.logger.error(`Binance: Error on symbol order fetch: ${String(e)}`);
          return resolve(undefined);
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
            return {
              side: order.side.toLowerCase(),
              price: parseFloat(order.price),
              symbol: order.symbol,
              time: new Date(order.time),
              size: parseFloat(order.executedQty)
            };
          });

        return resolve({ symbol: symbol, orders: orders });
      });
    });

    (await Promise.all(promises)).forEach(o => {
      if (o) {
        this.trades[o.symbol] = o.orders;
      }
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
