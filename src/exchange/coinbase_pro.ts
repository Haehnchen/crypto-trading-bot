import Gdax from 'coinbase-pro';
import moment from 'moment';
import { ExchangeCandlestick } from '../dict/exchange_candlestick';
import { Ticker } from '../dict/ticker';
import { TickerEvent } from '../event/ticker_event';
import { OrderUtil } from '../utils/order_util';
import { Resample } from '../utils/resample';
import { CandlesFromTrades } from './utils/candles_from_trades';
import { ExchangeOrder, ExchangeOrderStatus, ExchangeOrderType } from '../dict/exchange_order';
import { Position } from '../dict/position';
import { Order } from '../dict/order';
import { EventEmitter } from 'events';
import type { Logger } from '../modules/services';
import type { QueueManager } from '../utils/queue';
import type { CandleImporter } from '../modules/system/candle_importer';
import type { CandlestickResample } from '../modules/system/candlestick_resample';

interface FillInfo {
  size: number;
  costs: number;
  average_price?: number;
  created_at?: string;
}

interface ExchangePairInfo {
  tick_size: number;
  lot_size: number;
}

export class CoinbasePro {
  private candlesFromTrades: CandlesFromTrades;
  private client: any;
  private orders: Record<string, ExchangeOrder> = {};
  private exchangePairs: Record<string, ExchangePairInfo> = {};
  private symbols: any[] = [];
  private tickers: Record<string, Ticker> = {};
  private fills: Record<string, any[]> = {};
  private balances: any[] = [];
  private intervals: NodeJS.Timeout[] = [];
  private candles?: Record<string, any>;
  private lastCandleMap?: Record<string, any>;

  constructor(
    private eventEmitter: EventEmitter,
    private logger: Logger,
    private candlestickResample: CandlestickResample,
    private queue: QueueManager,
    private candleImporter: CandleImporter
  ) {
    this.candlesFromTrades = new CandlesFromTrades(candlestickResample, candleImporter);
  }

  start(config: any, symbols: any[]): void {
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

    let wsAuth: any = {};

    const channels = ['ticker', 'matches'];

    let isAuth = false;

    if (config.key && config.secret && config.passphrase && config.key.length > 0 && config.secret.length > 0 && config.passphrase.length > 0) {
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

    symbols.forEach((symbol: any) => {
      symbol.periods.forEach((interval: string) =>
        this.queue.add(async () => {
          // backfill
          const granularity = Resample.convertPeriodToMinute(interval) * 60;

          let candles;
          try {
            candles = await this.client.getProductHistoricRates(symbol.symbol, { granularity: granularity });
          } catch (e) {
            this.logger.error(`Coinbase Pro: candles fetch error: ${JSON.stringify([symbol.symbol, interval, String(e)])}`);
            return;
          }

          const ourCandles = candles.map(
            (candle: any) => new ExchangeCandlestick(this.getName(), symbol.symbol, interval, candle[0], candle[3], candle[2], candle[1], candle[4], candle[5])
          );

          await this.candleImporter.insertThrottledCandles(ourCandles);
        })
      );
    });

    const me = this;

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

    websocket.on('message', async (data: any) => {
      if (data.type && data.type === 'ticker') {
        const ticker = (this.tickers[data.product_id] = new Ticker(
          this.getName(),
          data.product_id,
          parseInt(moment().format('X'), 10),
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

    websocket.on('error', (err: any) => {
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
  async onTrade(msg: any, symbols: any[]): Promise<void> {
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

  async getOrders(): Promise<ExchangeOrder[]> {
    const orders: ExchangeOrder[] = [];

    for (const key in this.orders) {
      if (this.orders[key].status === 'open') {
        orders.push(this.orders[key]);
      }
    }

    return orders;
  }

  async findOrderById(id: string | number): Promise<ExchangeOrder | undefined> {
    return (await this.getOrders()).find(order => order.id === id || order.id == id);
  }

  async getOrdersForSymbol(symbol: string): Promise<ExchangeOrder[]> {
    return (await this.getOrders()).filter(order => order.symbol === symbol);
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
    const capitals: Record<string, number> = {};
    this.symbols
      .filter((s: any) => s.trade && ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0)))
      .forEach((s: any) => {
        if (s.trade.capital > 0) {
          capitals[s.symbol] = s.trade.capital;
        } else if (s.trade.currency_capital > 0 && this.tickers[s.symbol] && this.tickers[s.symbol].bid) {
          capitals[s.symbol] = s.trade.currency_capital / this.tickers[s.symbol].bid;
        }
      });

    const positions: Position[] = [];
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
            createdAt = new Date(result.created_at!);
            entry = result.average_price;

            // calculate profit based on the ticket price
            if (this.tickers[pair] && this.tickers[pair].bid) {
              profit = (this.tickers[pair].bid / result.average_price! - 1) * 100;
            }
          }
        }

        positions.push(new Position(pair, 'long', balanceUsed, profit || 0, new Date(), entry || 0, createdAt));
      }
    }

    return positions;
  }

  static calculateEntryOnFills(fills: any[], balance?: number): FillInfo | undefined {
    const result: FillInfo = {
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
      if (balance && number > balance * 1.15) {
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

  async getPositionForSymbol(symbol: string): Promise<Position | undefined> {
    return (await this.getPositions()).find(position => {
      return position.symbol === symbol;
    });
  }

  async syncOrders(): Promise<void> {
    let ordersRaw: any[] = [];

    try {
      ordersRaw = await this.client.getOrders({ status: 'open' });
    } catch (e) {
      this.logger.error(`Coinbase Pro: orders ${String(e)}`);
      return;
    }

    const orders: Record<string, ExchangeOrder> = {};
    CoinbasePro.createOrders(...ordersRaw).forEach(o => {
      orders[o.id] = o;
    });

    this.orders = orders;
  }

  async syncBalances(): Promise<void> {
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

    this.balances = accounts.filter((b: any) => parseFloat(b.balance) > 0);
    this.logger.debug(`Coinbase Pro: Sync balances ${this.balances.length}`);
  }

  async syncFills(productId?: string): Promise<void> {
    let symbols: string[] = [];

    if (productId) {
      symbols.push(productId);
    } else {
      symbols = this.symbols
        .filter((s: any) => s.trade && ((s.trade.capital && s.trade.capital > 0) || (s.trade.currency_capital && s.trade.currency_capital > 0)))
        .map((x: any) => {
          return x.symbol;
        });
    }

    this.logger.debug(`Coinbase Pro: Syncing fills: ${JSON.stringify([symbols])}`);

    for (const symbol of symbols) {
      try {
        this.fills[symbol] = (await this.client.getFills({ product_id: symbol })).slice(0, 15);
      } catch (e: any) {
        this.logger.error(`Coinbase Pro: fill sync error:${JSON.stringify([symbol, e.message])}`);
      }
    }
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order: ExchangeOrder): void {
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

  async order(order: Order): Promise<ExchangeOrder | undefined> {
    const payload = CoinbasePro.createOrderBody(order);
    let result;

    try {
      result = await this.client.placeOrder(payload);
    } catch (e: any) {
      this.logger.error(`Coinbase Pro: order create error: ${JSON.stringify([e.message, order, payload])}`);

      if (
        e.message &&
        (e.message.match(/HTTP\s4\d{2}/i) || e.message.toLowerCase().includes('size is too accurate') || e.message.toLowerCase().includes('size is too small'))
      ) {
        return ExchangeOrder.createRejectedFromOrder(order, e.message);
      }

      return undefined;
    }

    const exchangeOrder = CoinbasePro.createOrders(result)[0];

    this.triggerOrder(exchangeOrder);
    return exchangeOrder;
  }

  async cancelOrder(id: string | number): Promise<ExchangeOrder | undefined> {
    let orderId;

    try {
      orderId = await this.client.cancelOrder(String(id));
    } catch (e) {
      this.logger.error(`Coinbase Pro: cancel order error: ${e}`);
      return undefined;
    }

    delete this.orders[orderId];
    return undefined;
  }

  async cancelAll(symbol: string): Promise<void> {
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

  static createOrderBody(order: Order): Record<string, any> {
    if (!order.getAmount() && !order.getPrice() && !order.getSymbol()) {
      throw new Error('Invalid amount for update');
    }

    const myOrder: Record<string, any> = {
      side: order.isShort() ? 'sell' : 'buy',
      price: order.getPrice(),
      size: order.getAmount(),
      product_id: order.getSymbol()
    };

    let orderType: string | undefined;
    const originOrderType = order.getType();
    if (!originOrderType || originOrderType === 'limit') {
      orderType = 'limit';
    } else if (originOrderType === 'stop') {
      orderType = 'stop';
    } else if (originOrderType === 'market') {
      orderType = 'market';
    }

    if (!orderType) {
      throw new Error('Invalid order type');
    }

    myOrder.type = orderType;

    if (order.isPostOnly()) {
      myOrder.post_only = true;
    }

    return myOrder;
  }

  static createOrders(...orders: any[]): ExchangeOrder[] {
    return orders.map(order => {
      let retry = false;

      let status: ExchangeOrderStatus;
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
      } else {
        status = 'open';
      }

      const ordType = order.type.toLowerCase().replace(/[\W_]+/g, '');

      // secure the value
      let orderType: ExchangeOrderType;
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

  async updateOrder(id: string | number, order: Partial<Pick<Order, 'amount' | 'price'>>): Promise<ExchangeOrder | undefined> {
    if (!order.amount && !order.price) {
      throw new Error('Invalid amount / price for update');
    }

    const currentOrder = await this.findOrderById(id);
    if (!currentOrder) {
      return undefined;
    }

    // cancel order; mostly it can already be canceled
    await this.cancelOrder(id);

    return await this.order(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount));
  }

  async syncPairInfo(): Promise<void> {
    let pairs;
    try {
      pairs = await this.client.getProducts();
    } catch (e) {
      this.logger.error(`Coinbase Pro: pair sync error: ${e}`);

      return;
    }

    const exchangePairs: Record<string, ExchangePairInfo> = {};
    pairs.forEach((pair: any) => {
      exchangePairs[pair.id] = {
        tick_size: parseFloat(pair.quote_increment),
        lot_size: parseFloat(pair.base_min_size)
      };
    });

    this.logger.info(`Coinbase Pro: pairs synced: ${pairs.length}`);
    this.exchangePairs = exchangePairs;
  }

  getName(): string {
    return 'coinbase_pro';
  }

  isInverseSymbol(_symbol: string): boolean {
    return false;
  }
}

export default CoinbasePro;
