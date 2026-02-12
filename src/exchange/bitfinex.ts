import BFX from 'bitfinex-api-node';
import { Order } from 'bfx-api-node-models';
import moment from 'moment';
import _ from 'lodash';
import { ExchangeCandlestick } from '../dict/exchange_candlestick';
import { Ticker } from '../dict/ticker';
import { Position } from '../dict/position';
import { TickerEvent } from '../event/ticker_event';
import { ExchangeOrder, ExchangeOrderStatus, ExchangeOrderSide, ExchangeOrderType } from '../dict/exchange_order';
import { Order as MyOrder } from '../dict/order';
import { EventEmitter } from 'events';
import type { Logger } from '../modules/services';
import type { CandleImporter } from '../modules/system/candle_importer';
import type { RequestClient } from '../utils/request_client';

export class Bitfinex {
  private eventEmitter: EventEmitter;
  private candleImport: CandleImporter;
  private logger: Logger;
  private requestClient: RequestClient;
  private tickers: Record<string, Ticker>;

  private positions: Record<string, Position>;
  private orders: Record<string, ExchangeOrder>;
  private client: any;
  private balanceInfo?: any;

  constructor(eventEmitter: EventEmitter, logger: Logger, requestClient: RequestClient, candleImport: CandleImporter) {
    this.eventEmitter = eventEmitter;
    this.candleImport = candleImport;
    this.logger = logger;
    this.positions = {};
    this.orders = {};
    this.requestClient = requestClient;
    this.tickers = {};
  }

  start(config: any, symbols: any[]): void {
    const subscriptions: any[] = [];

    symbols.forEach((instance: any) => {
      // candles
      instance.periods.forEach((period: string) => {
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
    _.chunk(subscriptions, 25).forEach((chunk: any[], index: number) => {
      // chunk connect, but wait for each chunk for possible connection limit
      setTimeout(async () => {
        this.openPublicWebsocketChunk(chunk, index + 1);
      }, 2250 * (index + 1));
    });

    const isAuthed = config.key && config.secret && config.key.length > 0 && config.secret.length > 0;

    if (!isAuthed) {
      this.logger.info('Bitfinex: Starting as anonymous; no trading possible');
    } else {
      this.client = this.openAuthenticatedPublicWebsocket(config.key, config.secret);
    }
  }

  getName(): string {
    return 'bitfinex';
  }

  /**
   * Position events from websocket: New, Update, Delete
   */
  onPositionUpdate(position: any): void {
    if (position.status && position.status.toLowerCase() === 'closed') {
      delete this.positions[Bitfinex.formatSymbol(position.symbol)];
      return;
    }

    const myPositions = Bitfinex.createPositions([position]);

    if (myPositions.length > 0) {
      const [firstPosition] = myPositions;
      // copy position create time
      if (this.positions[firstPosition.symbol] && this.positions[firstPosition.symbol].createdAt) {
        firstPosition.createdAt = this.positions[firstPosition.symbol].createdAt;
      }

      this.positions[firstPosition.symbol] = firstPosition;
    }
  }

  onPositions(positions: any[]): void {
    const myPositions: Record<string, Position> = {};

    Bitfinex.createPositions(positions).forEach(position => {
      myPositions[position.symbol] = position;
    });

    this.positions = myPositions;
  }

  /**
   * Order events from websocket: New, Update, Delete
   */
  onOrderUpdate(orderUpdate: any): void {
    if (orderUpdate.type.toLowerCase().includes('exchange')) {
      return;
    }

    const order = Bitfinex.createExchangeOrder(orderUpdate);

    this.logger.info(`Bitfinex: order update: ${JSON.stringify(order)}`);
    this.orders[order.id] = order;
  }

  async order(order: MyOrder): Promise<ExchangeOrder> {
    const result = await new Order(Bitfinex.createOrder(order)).submit(this.client);

    const executedOrder = Bitfinex.createExchangeOrder(result);
    this.triggerOrder(executedOrder);

    return executedOrder;
  }

  async updateOrder(id: string | number, order: Partial<Pick<MyOrder, 'amount' | 'price'>>): Promise<ExchangeOrder> {
    const changes: any = {
      id: id
    };

    if (order.amount) {
      // amount need be negative on sell / short orders; as on order create
      const ourOrder = await this.findOrderById(id);
      changes.amount = String(ourOrder && ourOrder.isShort() ? order.amount * -1 : order.amount);
    }

    if (order.price) {
      changes.price = String(order.price);
    }

    let result;
    try {
      result = await this.client.updateOrder(changes);
    } catch (e: any) {
      this.logger.error(`Bitfinex: error updating order: ${JSON.stringify([id, order, e.message])}`);
      throw e;
    }

    const unseralized = Order.unserialize(result);

    const executedOrder = Bitfinex.createExchangeOrder(unseralized);
    this.triggerOrder(executedOrder);

    return executedOrder;
  }

  async getOrders(): Promise<ExchangeOrder[]> {
    return Object.values(this.orders).filter(order => order.status === 'open');
  }

  async getOrdersForSymbol(symbol: string): Promise<ExchangeOrder[]> {
    return Object.values(this.orders).filter(order => order.status === 'open' && order.symbol === symbol);
  }

  /**
   * https://docs.bitfinex.com/docs#price-precision
   * The precision level of all trading prices is based on significant figures. All pairs on Bitfinex use up to 5 significant digits and up to 8 decimals (e.g. 1.2345, 123.45, 1234.5, 0.00012345). Prices submit with a precision larger than 5 will be cut by the API.
   *
   * @param price
   * @returns {number}
   */
  calculatePrice(price: number): number {
    // return Number.parseFloat(Number.parseFloat(price).toPrecision(BFX_PRICE_PRECISION));
    return Number.parseFloat(String(price));
  }

  /**
   * https://docs.bitfinex.com/docs#amount-precision
   * The amount field allows up to 8 decimals. Anything exceeding this will be rounded to the 8th decimal.
   *
   * @param amount
   * @returns {number}
   */
  calculateAmount(amount: number): number {
    // return Number.parseFloat(Number.parseFloat(amount).toPrecision(BFX_AMOUNT_PRECISION));
    return Number.parseFloat(String(amount));
  }

  async getPositions(): Promise<Position[]> {
    return Object.values(this.positions).map(position =>
      position.entry && this.tickers[position.symbol]
        ? Position.createProfitUpdate(
            position,
            (position.side === Position.SIDE_LONG
              ? this.tickers[position.symbol].bid / position.entry - 1
              : position.entry / this.tickers[position.symbol].ask - 1) * 100
          )
        : position
    );
  }

  async getPositionForSymbol(symbol: string): Promise<Position | undefined> {
    return Object.values(this.positions).find(pos => pos.symbol === symbol);
  }

  async cancelOrder(id: string | number): Promise<ExchangeOrder | undefined> {
    // external lib does not support string as id; must be int
    // is failing in a timeout
    let cancelOrderId = id;
    if (typeof id === 'string' && id.match(/^\d+$/)) {
      cancelOrderId = parseInt(id, 10);
    }

    const order = await this.findOrderById(cancelOrderId);
    if (!order) {
      return undefined;
    }

    try {
      await this.client.cancelOrder(cancelOrderId);
    } catch (e: any) {
      this.logger.error(`Bitfinex: cancel order error: ${e}`);

      if (String(e).toLowerCase().includes('not found')) {
        this.logger.info(`Bitfinex: "Order not found" clear`);
        delete this.orders[id];
      }

      return ExchangeOrder.createCanceled(order);
    }

    delete this.orders[id];

    return ExchangeOrder.createCanceled(order);
  }

  async findOrderById(id: string | number): Promise<ExchangeOrder | undefined> {
    const orders = await this.getOrders();
    return orders.find(order => parseInt(String(order.id), 10) === id);
  }

  async cancelAll(symbol: string): Promise<(ExchangeOrder | undefined)[]> {
    const orders = await this.getOrdersForSymbol(symbol);
    return Promise.all(
      orders.map(o => {
        return this.cancelOrder(o.id);
      })
    );
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order: ExchangeOrder): void {
    if (!(order instanceof ExchangeOrder)) {
      throw new Error(`Invalid order given`);
    }

    // dont overwrite state closed order
    if (order.id in this.orders && ['done', 'canceled'].includes(this.orders[order.id].status)) {
      delete this.orders[order.id];
      return;
    }

    this.orders[order.id] = order;
  }

  static createExchangeOrder(order: any): ExchangeOrder {
    let status: ExchangeOrderStatus;
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
    } else {
      status = 'open';
    }

    const bitfinexId = order.id;
    const { price } = order;

    let orderType: ExchangeOrderType;
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

    const orderValues: Record<string, any> = {};
    if ('_fieldKeys' in order) {
      const { _fieldKeys: fieldKeys } = order;
      fieldKeys.forEach((k: string) => {
        orderValues[k] = order[k];
      });
    }

    return new ExchangeOrder(
      bitfinexId,
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

  static createExchangeOrders(orders: any[]): ExchangeOrder[] {
    return orders.map(Bitfinex.createExchangeOrder);
  }

  static createOrder(order: MyOrder): any {
    const amount = order.getAmount();

    const orderOptions: Record<string, any> = {
      cid: order.getId(),
      symbol: `t${order.getSymbol()}`,
      amount: order.isShort() ? amount * -1 : amount,
      meta: { aff_code: 'kDLceRHa' }
    };

    const orderType = order.getType();
    if (!orderType || orderType === 'limit') {
      orderOptions.type = Order.type.LIMIT;
      orderOptions.price = String(order.getPrice());
    } else if (orderType === 'stop') {
      orderOptions.type = Order.type.STOP;
      orderOptions.price = String(order.getPrice());
    } else if (orderType === 'market') {
      orderOptions.type = Order.type.MARKET;
    } else if (orderType === 'trailing_stop') {
      orderOptions.type = Order.type.TRAILING_STOP;
      orderOptions.price = String(order.getPrice());
    }

    const myOrder = new Order(orderOptions);

    if (order.isPostOnly()) {
      myOrder.setPostOnly(true);
    }

    if (order.options && order.options.close === true && orderOptions.type && orderOptions.type === Order.type.STOP) {
      myOrder.setReduceOnly(true);
    }

    return myOrder;
  }

  static createPositions(positions: any[]): Position[] {
    return positions
      .filter(position => {
        return position.status.toLowerCase() === 'active';
      })
      .map(position => {
        return new Position(
          Bitfinex.formatSymbol(position.symbol),
          position.amount < 0 ? 'short' : 'long',
          position.amount,
          position.plPerc,
          new Date(),
          position.basePrice,
          new Date()
        );
      });
  }

  static formatSymbol(symbol: string): string {
    return symbol.substring(0, 1) === 't' ? symbol.substring(1) : symbol;
  }

  isInverseSymbol(): boolean {
    return false;
  }

  getTradableBalance(): number | undefined {
    return this.balanceInfo ? this.balanceInfo.amountNet : undefined;
  }

  /**
   * Connect to websocket on chunks because Bitfinex limits per connection subscriptions eg to 30
   *
   * @param subscriptions
   * @param index current chunk
   */
  openPublicWebsocketChunk(subscriptions: any[], index: number): void {
    const me = this;

    me.logger.debug(`Bitfinex: public websocket ${index} chunks connecting: ${JSON.stringify(subscriptions)}`);

    const ws = new BFX({
      transform: true,
      ws: {
        autoReconnect: true,
        reconnectDelay: 10 * 1000,
        packetWDDelay: 60 * 1000 // - watch-dog forced reconnection delay
      }
    }).ws();

    ws.on('error', (err: any) => {
      me.logger.error(`Bitfinex: public websocket ${index} error: ${JSON.stringify([err.message, err])}`);
    });

    ws.on('close', () => {
      me.logger.error(`Bitfinex: public websocket ${index} Connection closed; reconnecting soon`);
    });

    ws.once('open', () => {
      me.logger.info(`Bitfinex: public websocket ${index} connection open. Subscription to ${subscriptions.length} channels`);

      subscriptions.forEach(subscription => {
        (ws as any)[subscription.type](subscription.parameter);
      });
    });

    ws.on('ticker', (pair: any, ticker: any) => {
      const symbol = Bitfinex.formatSymbol(pair);

      me.eventEmitter.emit(
        'ticker',
        new TickerEvent('bitfinex', symbol, (me.tickers[symbol] = new Ticker('bitfinex', symbol, parseInt(moment().format('X'), 10), ticker.bid, ticker.ask)))
      );
    });

    ws.on('candle', async (candles: any, pair: string) => {
      const options = pair.split(':');

      if (options.length < 3) {
        return;
      }

      const period = options[1].toLowerCase();
      let mySymbol = options[2];

      if (mySymbol.substring(0, 1) === 't') {
        mySymbol = mySymbol.substring(1);
      }

      const myCandles: any[] = [];

      if (Array.isArray(candles)) {
        candles.forEach(function (candle: any) {
          myCandles.push(candle);
        });
      } else {
        myCandles.push(candles);
      }

      const sticks = myCandles
        .filter(function (candle: any) {
          return typeof candle.mts !== 'undefined';
        })
        .map(function (candle: any) {
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
  openAuthenticatedPublicWebsocket(apiKey: string, apiSecret: string): any {
    const ws = new BFX({
      version: 2,
      transform: true,
      apiKey: apiKey,
      apiSecret: apiSecret,
      ws: {
        autoReconnect: true,
        reconnectDelay: 10 * 1000,
        packetWDDelay: 60 * 1000 // - watch-dog forced reconnection delay
      }
    }).ws();

    const me = this;

    this.logger.info('Bitfinex: Authenticated Websocket connecting');

    ws.on('error', (err: any) => {
      me.logger.error(`Bitfinex: Authenticated Websocket error: ${JSON.stringify([err.message, err])}`);
    });

    ws.on('close', () => {
      me.logger.error('Bitfinex: Authenticated Websocket Connection closed; reconnecting soon');
    });

    ws.once('open', () => {
      me.logger.debug('Bitfinex: Authenticated Websocket Connection open');

      // authenticate
      (ws as any).auth();
    });

    (ws as any).onOrderUpdate({}, (order: any) => {
      me.onOrderUpdate(order);
    });

    (ws as any).onOrderNew({}, (order: any) => {
      me.onOrderUpdate(order);
    });

    (ws as any).onOrderClose({}, (order: any) => {
      me.onOrderUpdate(order);
    });

    (ws as any).onOrderSnapshot({}, (orders: any[]) => {
      const marginOrder = orders.filter(order => !order.type.toLowerCase().includes('exchange'));

      Bitfinex.createExchangeOrders(marginOrder).forEach(order => {
        me.orders[order.id] = order;
      });
    });

    (ws as any).onPositionSnapshot({}, (positions: any[]) => {
      me.onPositions(positions);
    });

    (ws as any).onPositionUpdate({}, (position: any) => {
      me.onPositionUpdate(position);
    });

    (ws as any).onPositionNew({}, (position: any) => {
      me.onPositionUpdate(position);
    });

    (ws as any).onPositionClose({}, (position: any) => {
      me.onPositionUpdate(position);
    });

    (ws as any).onBalanceInfoUpdate({}, (balanceInfo: any) => {
      this.balanceInfo = balanceInfo;
    });

    ws.open();

    return ws;
  }
}

export default Bitfinex;
