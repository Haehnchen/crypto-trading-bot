'use strict';

import BinanceClient from 'binance-api-node';

import moment from 'moment';
import _ from 'lodash';
import { Binance as BinanceClass } from './binance';
import { ExchangeCandlestick } from '../dict/exchange_candlestick';
import { Ticker } from '../dict/ticker';
import { TickerEvent } from '../event/ticker_event';
import { ExchangeOrder } from '../dict/exchange_order';
import { OrderUtil } from '../utils/order_util';
import { TradesUtil } from './utils/trades_util';
import { Position } from '../dict/position';
import { Order } from '../dict/order';
import { OrderBag } from './utils/order_bag';
import { EventEmitter } from 'events';

export class BinanceMargin {
  private eventEmitter: EventEmitter;
  private candleImport: any;
  private logger: any;
  private queue: any;
  private throttler: any;
  private client: any;
  private exchangePairs: Record<string, ExchangePairInfo>;
  private symbols: any[];
  private positions: Position[];
  private trades: Record<string, any[]>;
  private tickers: Record<string, Ticker>;
  private balances: any[];
  private orderbag: OrderBag;

  constructor(eventEmitter: EventEmitter, logger: any, queue: any, candleImport: any, throttler: any) {
    this.eventEmitter = eventEmitter;
    this.candleImport = candleImport;
    this.logger = logger;
    this.queue = queue;
    this.throttler = throttler;

    this.client = undefined;
    this.exchangePairs = {};
    this.symbols = [];
    this.positions = [];
    this.trades = {};
    this.tickers = {};
    this.balances = [];
    this.orderbag = new OrderBag();
  }

  start(config: any, symbols: any[]): void {
    this.symbols = symbols;

    const opts: any = {};

    if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
      opts.apiKey = config.key;
      opts.apiSecret = config.secret;
    }

    const client: any = (this.client = BinanceClient(opts));

    const me = this;

    if (config.key && config.secret) {
      this.client.ws.marginUser(async (event: any) => {
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
          me.logger.info(`Binance Margin: init trades for positions: ${JSON.stringify(initSymbols)}`);
          await me.syncTradesForEntries(initSymbols);
        }, 13312);
      }, 1523);

      setInterval(async () => {
        await me.syncBalances();
      }, 5 * 60 * 1198);

      setInterval(async () => {
        await me.syncTradesForEntries();
      }, 15 * 60 * 1098);

      setInterval(async () => {
        await me.syncOrders();
      }, 30 * 1232);

      setInterval(async () => {
        await me.syncPairInfo();
      }, 30 * 60 * 1051);
    } else {
      this.logger.info('Binance Margin: Starting as anonymous; no trading possible');
    }

    let tickersToOpen = 0;
    const { eventEmitter } = this;
    symbols.forEach(symbol => {
      // live prices
      client.ws.ticker(symbol.symbol, (ticker: any) => {
        eventEmitter.emit(
          'ticker',
          new TickerEvent(
            'binance_margin',
            symbol.symbol,
            (this.tickers[symbol.symbol] = new Ticker(
              'binance_margin',
              symbol.symbol,
              parseInt(moment().format('X'), 10),
              ticker.bestBid,
              ticker.bestAsk
            ))
          )
        );
      });

      symbol.periods.forEach((interval: string) => {
        // backfill
        this.queue.add(() => {
          client.candles({ symbol: symbol.symbol, limit: 500, interval: interval as any }).then(async candles => {
            const ourCandles = candles.map((candle: any) => {
              return new ExchangeCandlestick(
                'binance_margin',
                symbol.symbol,
                interval,
                Math.round(candle.openTime / 1000),
                parseFloat(candle.open),
                parseFloat(candle.high),
                parseFloat(candle.low),
                parseFloat(candle.close),
                parseFloat(candle.volume)
              );
            });

            await this.candleImport.insertThrottledCandles(ourCandles);
          });
        });

        // live candles
        tickersToOpen++;
        if (tickersToOpen < 200) {
          setTimeout(() => {
            client.ws.candles(symbol.symbol, interval, async candle => {
              const ourCandle = new ExchangeCandlestick(
                'binance_margin',
                symbol.symbol,
                interval,
                Math.round(candle.startTime / 1000),
                parseFloat(candle.open),
                parseFloat(candle.high),
                parseFloat(candle.low),
                parseFloat(candle.close),
                parseFloat(candle.volume)
              );

              await this.candleImport.insertThrottledCandles([ourCandle]);
            });
          }, 200 * tickersToOpen);
        } else {
          this.logger.info(`Binance Margin: Too many tickers for websocket skipping: ${symbol.symbol} - ${interval}`);
        }
      });
    });

    this.logger.info(`Binance Margin: Websocket tickers to open: ${tickersToOpen}`);
  }

  async order(order: Order): Promise<ExchangeOrder | undefined> {
    const payload = BinanceClass.createOrderBody(order);

    // on open position for need to repay via AUTO_REPAY else be borrowing via MARGIN_BUY
    const position = await this.getPositionForSymbol(order.getSymbol());

    if (!position) {
      // no position so open it with borrow
      payload.sideEffectType = 'MARGIN_BUY';
    } else {
      // borrow: add to position
      if ((order.isLong() && position.isLong()) || (order.isShort() && position.isShort())) {
        payload.sideEffectType = 'MARGIN_BUY';
      }

      // repay: close position
      if ((order.isLong() && position.isShort()) || (order.isShort() && position.isLong())) {
        payload.sideEffectType = 'AUTO_REPAY';
      }
    }

    let result: any;

    try {
      result = await this.client.marginOrder(payload);
    } catch (e: any) {
      this.logger.error(`Binance Margin: order create error: ${JSON.stringify([e.code, e.message, order, payload])}`);

      // @TODO: retry possible: [-3007,"You have pending transcation, please try again later." // typo "transcation" externally ;)
      // -2010: insufficient balance
      // -XXXX: borrow amount has exceed
      if (
        (e.message &&
          (e.message.toLowerCase().includes('insufficient balance') ||
            e.message.toLowerCase().includes('borrow amount has exceed'))) ||
        (e.code && e.code === -2010)
      ) {
        return ExchangeOrder.createRejectedFromOrder(order, `${e.code} - ${e.message}`);
      }

      return undefined;
    }

    const exchangeOrder = BinanceClass.createOrders(result)[0];
    this.triggerOrder(exchangeOrder);
    return exchangeOrder;
  }

  async cancelOrder(id: string | number): Promise<ExchangeOrder | undefined> {
    const order = await this.findOrderById(id);
    if (!order) {
      return undefined;
    }

    try {
      await this.client.marginCancelOrder({
        symbol: order.symbol,
        orderId: id
      });
    } catch (e: any) {
      const message = String(e).toLowerCase();

      // "Error: Unknown order sent."
      if (message.includes('unknown order sent')) {
        this.logger.info(`Binance Margin: cancel order not found remove it: ${JSON.stringify([e, id])}`);
        this.orderbag.delete(id);
        return ExchangeOrder.createCanceled(order);
      }

      this.logger.error(`Binance Margin: cancel order error: ${JSON.stringify([e, id])}`);

      return undefined;
    }

    this.orderbag.delete(id);

    return ExchangeOrder.createCanceled(order);
  }

  async cancelAll(symbol: string): Promise<(ExchangeOrder | undefined)[]> {
    const orders: (ExchangeOrder | undefined)[] = [];

    for (const order of await this.getOrdersForSymbol(symbol)) {
      orders.push(await this.cancelOrder(order.id));
    }

    return orders;
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order: ExchangeOrder): void {
    return this.orderbag.triggerOrder(order);
  }

  async getOrders(): Promise<ExchangeOrder[]> {
    return this.orderbag.getOrders();
  }

  async findOrderById(id: string | number): Promise<ExchangeOrder | undefined> {
    return this.orderbag.findOrderById(id);
  }

  async getOrdersForSymbol(symbol: string): Promise<ExchangeOrder[]> {
    return this.orderbag.getOrdersForSymbol(symbol);
  }

  /**
   * LTC: 0.008195 => 0.00820
   *
   * @param price
   * @param symbol
   * @returns {*}
   */
  calculatePrice(price: number, symbol: string): number | undefined {
    const pairInfo = this.exchangePairs[symbol];
    if (!pairInfo || pairInfo.tick_size === undefined) {
      return undefined;
    }

    return parseFloat(String(OrderUtil.calculateNearestSize(price, pairInfo.tick_size)));
  }

  /**
   * LTC: 0.65 => 1
   *
   * @param amount
   * @param symbol
   * @returns {*}
   */
  calculateAmount(amount: number, symbol: string): number | undefined {
    const pairInfo = this.exchangePairs[symbol];
    if (!pairInfo || pairInfo.lot_size === undefined) {
      return undefined;
    }

    return parseFloat(String(OrderUtil.calculateNearestSize(amount, pairInfo.lot_size)));
  }

  async getPositions(): Promise<Position[]> {
    const positions: Position[] = [];

    // get pairs with capital to fake open positions
    const capitals: Record<string, number> = {};
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

      const assetPositions: Position[] = [];

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

        let entry: number | undefined;
        let createdAt: Date | undefined;

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
        let profit: number | undefined;
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
            (b.createdAt ? b.createdAt.getTime() : new Date('1970-01-01').getTime()) - (a.createdAt ? a.createdAt.getTime() : new Date('1970-01-01').getTime())
        );

        positions.push(assetPositionsOrdered[0]);
      }
    }

    return positions;
  }

  async getPositionForSymbol(symbol: string): Promise<Position | undefined> {
    return (await this.getPositions()).find(position => position.symbol === symbol);
  }

  async updateOrder(id: string | number, order: Partial<Pick<Order, 'amount' | 'price'>>): Promise<ExchangeOrder | undefined> {
    if (!order.amount && !order.price) {
      throw new Error('Invalid amount / price for update');
    }

    const currentOrder = await this.findOrderById(id);
    if (!currentOrder) {
      this.logger.debug(`Binance Margin: Order to update not found: ${JSON.stringify([id, order])}`);
      return undefined;
    }

    // cancel order; mostly it can already be canceled
    await this.cancelOrder(id);

    return this.order(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount)) as Promise<ExchangeOrder>;
  }

  getName(): string {
    return 'binance_margin';
  }

  async onWebSocketEvent(event: any): Promise<void> {
    if (event.eventType && event.eventType === 'executionReport' && ('orderStatus' in event || 'orderId' in event)) {
      this.logger.debug(`Binance Margin: Got executionReport order event: ${JSON.stringify(event)}`);

      // clean orders with state is switching from open to close
      const orderStatus = event.orderStatus.toLowerCase();
      const isRemoveEvent =
        ['canceled', 'filled', 'rejected'].includes(orderStatus) && event.orderId && this.orderbag.get(event.orderId);

      if (isRemoveEvent) {
        this.logger.info(`Binance Margin: Removing non open order: ${orderStatus} - ${JSON.stringify(event)}`);
        this.orderbag.delete(event.orderId);
        this.throttler.addTask('binance_margin_sync_balances', this.syncBalances.bind(this), 500);
      }

      // sync all open orders and get entry based fire them in parallel
      this.throttler.addTask('binance_margin_sync_orders', this.syncOrders.bind(this));

      // set last order price to our trades. so we have directly profit and entry prices
      this.throttler.addTask(
        `binance_margin_sync_trades_for_entries_${event.symbol}`,
        async () => {
          await this.syncTradesForEntries([event.symbol]);
        },
        300
      );

      if ('orderId' in event && !isRemoveEvent) {
        const exchangeOrder = BinanceClass.createOrders(event)[0];
        this.orderbag.triggerOrder(exchangeOrder);
      }
    }

    // force balance update via api because:
    // - "account": old api (once full update)
    // - "outboundAccountPosition" given only delta
    // - "balanceUpdate" given not balances
    if (event.eventType && ['outboundAccountPosition', 'account', 'balanceUpdate'].includes(event.eventType)) {
      this.throttler.addTask('binance_margin_sync_balances', this.syncBalances.bind(this), 300);
    }
  }

  async syncOrders(): Promise<void> {
    this.logger.debug(`Binance Margin: Sync orders`);

    // false equal to all symbols
    let openOrders: any[] = [];
    try {
      openOrders = await this.client.marginOpenOrders(false);
    } catch (e) {
      this.logger.error(`Binance Margin: error sync orders: ${String(e)}`);
      return;
    }

    this.orderbag.set(BinanceClass.createOrders(...openOrders));
  }

  async syncBalances(): Promise<void> {
    let accountInfo: any;
    try {
      accountInfo = await this.client.marginAccountInfo();
    } catch (e) {
      this.logger.error(`Binance Margin: error sync balances: ${String(e)}`);
      return;
    }

    if (!accountInfo || !accountInfo.userAssets) {
      this.logger.error(`Binance Margin: invalid sync balances response: ${JSON.stringify(accountInfo)}`);
      return;
    }

    this.logger.debug('Binance Margin: Sync balances');

    this.balances = BinanceMargin.createMarginBalances(accountInfo.userAssets);
  }

  /**
   * Binance does not have position trading, but we need entry price so fetch them from filled order history
   *
   * @param symbols
   * @returns {Promise<void>}
   */
  async syncTradesForEntries(symbols: string[] = []): Promise<void> {
    // fetch all based on our allowed symbol capital
    if (symbols.length === 0) {
      const allSymbols = this.symbols
        .filter(
          s =>
            s.trade &&
            ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0))
        )
        .map(s => s.symbol);

      // we need position first and randomly add other
      const positionSymbols = _.shuffle((await this.getPositions()).map(p => p.getSymbol()));
      const unknown = _.shuffle(allSymbols).filter(s => !positionSymbols.includes(s));

      positionSymbols.push(...unknown);

      symbols = positionSymbols;
    }

    this.logger.debug(`Binance Margin: Sync trades for entries: ${symbols.length} - ${JSON.stringify(symbols)}`);

    const promises = symbols.map((symbol: string) => {
      return async () => {
        let symbolOrders: any[];

        try {
          symbolOrders = await this.client.marginAllOrders({
            symbol: symbol,
            limit: 10
          });
        } catch (e) {
          this.logger.info(`Binance Margin: Sync trades error for entries: ${symbol} - ${String(e)}`);
          return undefined;
        }

        const orders = symbolOrders
          .filter(
            // filled order and fully closed but be have also partially_filled ones if ordering was no fully done
            // in case order was canceled but executedQty is set we have a partially cancel
            (order: any) =>
              ['filled', 'partially_filled'].includes(order.status.toLowerCase()) ||
              (order.status.toLowerCase() === 'canceled' && parseFloat(order.executedQty) > 0)
          )
          .sort(
            // order by latest
            (a: any, b: any) => b.time - a.time
          )
          .map((order: any) => {
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
      };
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
      this.queue.addQueue2(async () => {
        const result = await p();
        if (result) {
          this.trades[result.symbol] = result.orders;
        }
      });
    });
  }

  async syncPairInfo(): Promise<void> {
    const pairs = await this.client.exchangeInfo();
    if (!pairs.symbols) {
      return;
    }

    const exchangePairs: Record<string, ExchangePairInfo> = {};
    pairs.symbols.forEach((pair: any) => {
      const priceFilter = pair.filters.find((f: any) => f.filterType === 'PRICE_FILTER');
      const lotSize = pair.filters.find((f: any) => f.filterType === 'LOT_SIZE');

      if (priceFilter && lotSize) {
        exchangePairs[pair.symbol] = {
          tick_size: parseFloat(priceFilter.tickSize),
          lot_size: parseFloat(lotSize.stepSize)
        };
      }
    });

    this.logger.info(`Binance Margin: pairs synced: ${pairs.symbols.length}`);
    this.exchangePairs = exchangePairs;
  }

  static createMarginBalances(balances: any[]): Balance[] {
    // ignore empty balances and stable coins
    return balances
      .filter(b => parseFloat(b.netAsset) !== 0 && !['USDT', 'BUSD', 'USDC'].includes(b.asset))
      .map((balance: any) => {
        return {
          available: parseFloat(balance.netAsset),
          locked: parseFloat(balance.locked),
          asset: balance.asset
        };
      });
  }

  isInverseSymbol(symbol: string): boolean {
    return false;
  }
}

interface ExchangePairInfo {
  tick_size: number;
  lot_size: number;
}

interface Balance {
  available: number;
  locked: number;
  asset: string;
}

export default BinanceMargin;
