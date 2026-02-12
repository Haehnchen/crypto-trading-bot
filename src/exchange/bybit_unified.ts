import moment from 'moment';
import ccxt from 'ccxt';
import { Ticker } from '../dict/ticker';
import { TickerEvent } from '../event/ticker_event';
import { ExchangeCandlestick } from '../dict/exchange_candlestick';
import { Position } from '../dict/position';
import CommonUtil = require('../utils/common_util');
import { ExchangeOrder } from '../dict/exchange_order';
import { OrderBag } from './utils/order_bag';
import { Order } from '../dict/order';
import { orderUtil } from '../utils/order_util';
import { EventEmitter } from 'events';
import type { Logger } from '../modules/services';
import type { QueueManager } from '../utils/queue';
import type { CandleImporter } from '../modules/system/candle_importer';

export class BybitUnified {
  private orderbag: OrderBag;
  private tickSizes: Record<string, number> = {};
  private lotSizes: Record<string, number> = {};
  private positions: Record<string, Position> = {};
  private orders: Record<string, ExchangeOrder> = {};
  private tickers: Record<string, Ticker> = {};
  private exchangeAuth?: any;

  constructor(
    private eventEmitter: EventEmitter,
    private logger: Logger,
    private queue: QueueManager,
    private candleImporter: CandleImporter
  ) {
    this.orderbag = new OrderBag();
  }

  async start(config: any, symbols: any[]): Promise<void> {
    const { eventEmitter } = this;
    const { logger } = this;
    const { tickSizes } = this;
    const { lotSizes } = this;
    const me = this;
    this.orderbag = new OrderBag();

    this.positions = {};
    this.orders = {};

    const exchange = new ccxt.pro.bybit({ newUpdates: false });

    setTimeout(async () => {
      const result = (await exchange.fetchMarkets()).filter(i => i.type === 'swap' && i.quote === 'USDT');
      result.forEach((instrument: any) => {
        tickSizes[instrument.symbol as string] = parseFloat(instrument.precision.price);
        lotSizes[instrument.symbol as string] = parseFloat(instrument.precision.amount);
      });
    }, 5000);

    setTimeout(async () => {
      const symbolPeriods: [string, string][] = [];
      symbols.forEach(symbol => {
        symbolPeriods.push(...symbol.periods.map((p: string) => [symbol.symbol, p] as [string, string]));
      });

      while (true) {
        try {
          const event = await exchange.watchOHLCVForSymbols(symbolPeriods);

          const cxchangeCandlesticks: ExchangeCandlestick[] = [];

          for (const [symbol, tickers] of Object.entries(event)) {
            for (const [period, candles] of Object.entries(tickers)) {
              // timestamp, open, high, low, close, volume
              cxchangeCandlesticks.push(
                ...candles.map(t => new ExchangeCandlestick(me.getName(), symbol, period, Math.round(t[0] / 1000), t[1], t[2], t[3], t[4], t[5]))
              );
            }
          }

          await me.candleImporter.insertThrottledCandles(cxchangeCandlesticks);
        } catch (e) {
          logger.error('watchOHLCVForSymbols error', e);
        }
      }
    }, 1000);

    const symboleIds = symbols.map(symbol => symbol.symbol);

    setTimeout(async () => {
      while (true) {
        try {
          const event = await exchange.watchTickers(symboleIds);

          for (const [symbol, ticker] of Object.entries(event)) {
            const tickerEvent = new TickerEvent(
              me.getName(),
              symbol,
              (me.tickers[symbol] = new Ticker(me.getName(), symbol, parseInt(moment().format('X'), 10), ticker.bid, ticker.ask))
            );
            eventEmitter.emit('ticker', tickerEvent);
          }
        } catch (e) {
          logger.error('watchTickers error', e);
        }
      }
    }, 1000);

    if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
      this.authInit(config.key, config.secret);
    } else {
      me.logger.info(`${this.getName()}: Starting as anonymous; no trading possible`);
    }

    symbols.forEach(symbol => {
      symbol.periods.forEach((period: string) => {
        // for bot init prefill data: load latest candles from api
        this.queue.add(async () => {
          let candles;
          try {
            candles = await exchange.fetchOHLCV(symbol.symbol, period, undefined, 500);
          } catch (e) {
            logger.error('backfill error bybit', symbol.symbol, period, e);
            return;
          }

          const candleSticks = candles.map(
            t => new ExchangeCandlestick(me.getName(), symbol.symbol, period, Math.round(t[0] / 1000), t[1], t[2], t[3], t[4], t[5])
          );

          await this.candleImporter.insertThrottledCandles(candleSticks);
        });
      });
    });
  }

  authInit(apiKey: string, secret: string): void {
    const exchange = new ccxt.pro.bybit({
      apiKey: apiKey,
      secret: secret,
      newUpdates: true
    });

    this.exchangeAuth = exchange;
    const me = this;

    setTimeout(async () => {
      await this.updatePostionsViaRest(exchange);
      await this.updateOrderViaRest(exchange);
    }, 2000);

    setInterval(() => this.updatePostionsViaRest(exchange), 31700);
    setInterval(() => this.updateOrderViaRest(exchange), 32900);

    setTimeout(async () => {
      while (true) {
        try {
          const positions = await exchange.watchPositions();
          BybitUnified.createPositionsWithOpenStateOnly(positions).forEach(position => {
            me.positions[position.symbol] = position;
          });
        } catch (e) {
          console.error(`${this.getName()}: watchPositions error: ${e.message}`);
          this.logger.error(`${this.getName()}: watchPositions error: ${e.message}`);
        }
      }
    }, 1000);

    setTimeout(async () => {
      while (true) {
        try {
          const orders = await exchange.watchOrders();
          BybitUnified.createOrders(orders).forEach(o => me.orderbag.triggerOrder(o));
        } catch (e) {
          console.error(`${this.getName()}: watchOrders error: ${e.message}`);
          this.logger.error(`${this.getName()}: watchOrders error: ${e.message}`);
        }
      }
    }, 1000);
  }

  async updateOrderViaRest(exchange: any, _me?: any): Promise<void> {
    try {
      const orders = await exchange.fetchOpenOrders();
      this.orderbag.set(BybitUnified.createOrders(orders));
      this.logger.debug(`${this.getName()}: orders via API updated: ${Object.keys(this.positions).length}`);
    } catch (e) {
      console.log(`${this.getName()}: orders via API error: ${e.message}`);
      this.logger.error(`${this.getName()}: orders via API error: ${e.message}`);
    }
  }

  async updatePostionsViaRest(exchange: any): Promise<void> {
    try {
      const positions = await exchange.fetchPositions();

      const positionsFinal: Record<string, Position> = {};
      BybitUnified.createPositionsWithOpenStateOnly(positions).forEach(position => {
        positionsFinal[position.symbol] = position;
      });

      this.positions = positionsFinal;
      this.logger.debug(`${this.getName()}: positions via API updated: ${Object.keys(this.positions).length}`);
    } catch (e) {
      console.log(`${this.getName()}: positions via API error: ${e.message}`);
      this.logger.error(`${this.getName()}: positions via API error: ${e.message}`);
    }
  }

  static createOrders(orders: any[]): ExchangeOrder[] {
    const myOrders: ExchangeOrder[] = [];

    orders.forEach(order => {
      let status: ExchangeOrder['status'];
      switch (order.status) {
        case 'open':
          status = 'open';
          break;
        case 'closed':
          status = 'done';
          break;
        case 'canceled':
          status = 'canceled';
          break;
        case 'rejected':
        case 'expired':
          status = 'rejected';
          break;
        default:
          console.error(`invalid order status: ${order.status}`);
          return;
      }

      let orderType: ExchangeOrder['type'];
      switch (order.type) {
        case 'limit':
          orderType = ExchangeOrder.TYPE_LIMIT;
          break;
        case 'market':
          orderType = ExchangeOrder.TYPE_MARKET;
          break;
        default:
          console.error(`invalid order type: ${order.type}`);
          return;
      }

      myOrders.push(
        new ExchangeOrder(
          order.id,
          order.symbol,
          order.status,
          order.price,
          order.amount,
          status === 'rejected',
          order.clientOrderId ? order.clientOrderId : undefined,
          order.side.toLowerCase() === 'buy' ? 'buy' : 'sell', // secure the value,
          orderType,
          new Date(isNaN(order.timestamp) ? order.timestamp : parseInt(order.timestamp)),
          new Date(),
          JSON.parse(JSON.stringify(order)),
          {
            post_only: order.postOnly || false,
            reduce_only: order.reduceOnly || false
          }
        )
      );
    });

    return myOrders;
  }

  static createPositionsWithOpenStateOnly(positions: any[]): Position[] {
    return positions
      .filter(position => ['short', 'long'].includes(position.side?.toLowerCase()))
      .map(position => {
        const side = position.side.toLowerCase() as 'long' | 'short';
        let size = position.contracts;

        if (side === 'short') {
          size *= -1;
        }

        return new Position(
          position.symbol,
          side,
          size,
          position.markPrice && position.entryPrice ? CommonUtil.getProfitAsPercent(side, position.markPrice, position.entryPrice) : undefined,
          new Date(),
          parseFloat(position.entryPrice),
          new Date(),
          position
        );
      });
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

  async getPositions(): Promise<Position[]> {
    return Object.values(this.positions);
  }

  async getPositionForSymbol(symbol: string): Promise<Position | undefined> {
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
  calculatePrice(price: number, symbol: string): number | undefined {
    const tickSize = this.tickSizes[symbol];
    if (tickSize === undefined) {
      return undefined;
    }

    return parseFloat(String(orderUtil.calculateNearestSize(price, tickSize)));
  }

  /**
   * LTC: 0.65 => 1
   *
   * @param amount
   * @param symbol
   * @returns {*}
   */
  calculateAmount(amount: number, symbol: string): number | undefined {
    const lotSize = this.lotSizes[symbol];
    if (lotSize === undefined) {
      return undefined;
    }

    return parseFloat(String(orderUtil.calculateNearestSize(amount, lotSize)));
  }

  getName(): string {
    return 'bybit_unified';
  }

  async order(order: Order): Promise<ExchangeOrder | undefined> {
    let orderType: 'limit' | 'market';
    switch (order.getType()) {
      case Order.TYPE_LIMIT:
        orderType = 'limit';
        break;
      case Order.TYPE_MARKET:
        orderType = 'market';
        break;
      default:
        console.error(`${this.getName()}: invalid orderType: ${order.getType()}`);
        this.logger.error(`${this.getName()}: invalid orderType: ${order.getType()}`);
        return undefined;
    }

    const params = {
      postOnly: order.isPostOnly(),
      reduceOnly: order.isReduceOnly()
    };

    let placedOrder: any;
    try {
      placedOrder = await this.exchangeAuth.createOrder(
        order.getSymbol(),
        orderType,
        order.isLong() ? 'buy' : 'sell',
        order.getAmount(),
        order.getPrice(),
        params
      );
    } catch (e: any) {
      this.logger.error(`${this.getName()}: order place error: ${e.message} ${JSON.stringify(order)}`);
      return ExchangeOrder.createRejectedFromOrder(order, e.message);
    }

    // wait what we get
    await this.exchangeAuth.sleep(1000);
    const o = await this.exchangeAuth.fetchOpenOrder(placedOrder.id);
    return BybitUnified.createOrders([o])[0];
  }

  async cancelOrder(id: string | number): Promise<void> {
    const order = await this.findOrderById(id);
    try {
      await this.exchangeAuth.cancelOrder(id, order.getSymbol());
    } catch (e: any) {
      this.logger.error(`${this.getName()}: order cancel error: ${e.message} ${JSON.stringify(id)}`);
    }
  }

  async cancelAll(symbol: string): Promise<void> {
    try {
      await this.exchangeAuth.cancelAllOrders(symbol);
    } catch (e: any) {
      this.logger.error(`${this.getName()}: order cancel all error: ${e.message} ${JSON.stringify(symbol)}`);
    }
  }

  isInverseSymbol(_symbol: string): boolean {
    return false;
  }
}

export default BybitUnified;
