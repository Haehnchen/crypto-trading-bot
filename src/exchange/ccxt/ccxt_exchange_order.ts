import ccxt from 'ccxt';
import _ from 'lodash';
import { OrderBag } from '../utils/order_bag';
import { Order } from '../../dict/order';
import { ExchangeOrder } from '../../dict/exchange_order';
import { CcxtUtil } from '../utils/ccxt_util';
import type { Logger } from '../../modules/services';

// CCXT Exchange type (using any for now due to typing issues)
type CcxtExchange = any;

export interface OrderCallbacks {
  createOrder?: (order: Order) => Record<string, any> | undefined;
  convertOrder?: (client: any, ccxtOrder: any) => void;
  syncOrders?: (client: any) => Promise<any[] | undefined>;
  cancelOrder?: (client: any, args: CancelOrderArgs) => Record<string, any> | undefined;
}

export interface CancelOrderArgs {
  id: string | number;
  symbol: string;
  order: ExchangeOrder;
}

export class CcxtExchangeOrder {
  private orderbag: OrderBag;
  private symbols: any[];
  private logger: Logger;
  private ccxtClient: CcxtExchange;
  private callbacks?: OrderCallbacks;

  constructor(ccxtClient: CcxtExchange, symbols: any[], logger: Logger, callbacks?: OrderCallbacks) {
    this.orderbag = new OrderBag();
    this.symbols = symbols;
    this.logger = logger;
    this.ccxtClient = ccxtClient;
    this.callbacks = callbacks;
  }

  async createOrder(order: Order): Promise<ExchangeOrder | undefined> {
    const side = order.isShort() ? 'sell' : 'buy';

    let parameters: Record<string, any> = {};

    if (this.callbacks && this.callbacks.createOrder) {
      const custom = this.callbacks.createOrder(order);

      if (custom) {
        parameters = _.merge(parameters, custom);
      }
    }

    let promise: Promise<any>;
    switch (order.getType()) {
      case Order.TYPE_STOP:
      case Order.TYPE_LIMIT:
        promise = this.ccxtClient.createOrder(order.getSymbol(), order.getType(), side, order.getAmount(), order.getPrice(), parameters.args || undefined);
        break;
      case Order.TYPE_MARKET:
        promise = this.ccxtClient.createOrder(order.getSymbol(), order.getType(), side, order.getAmount());
        break;
      default:
        throw new Error(`Ccxt order converter unsupported order type:${order.getType()}`);
    }

    let placedOrder;
    try {
      placedOrder = await promise;
    } catch (e: any) {
      // NetworkError is a base class in ccxt
      if (e && typeof e === 'object' && 'constructor' in e && e.constructor.name === 'NetworkError') {
        return undefined;
      }

      throw e;
    }

    const exchangeOrder = this.convertOrder(placedOrder);
    this.triggerOrder(exchangeOrder);
    return exchangeOrder;
  }

  async syncOrders(): Promise<ExchangeOrder[] | undefined> {
    let orders;
    try {
      orders = await this.ccxtClient.fetchOpenOrders();
    } catch (e) {
      this.logger.error(`SyncOrder timeout: ${String(e)}`);
      return undefined;
    }

    if (this.callbacks && this.callbacks.convertOrder) {
      orders.forEach((o: any) => {
        this.callbacks.convertOrder!(this.ccxtClient, o);
      });
    }

    const result = CcxtUtil.createExchangeOrders(orders);

    if (this.callbacks && this.callbacks.syncOrders) {
      let custom;
      try {
        custom = await this.callbacks.syncOrders(this.ccxtClient);
      } catch (e) {
        this.logger.error(`SyncOrder callback error: ${String(e)}`);
        return undefined;
      }

      if (custom) {
        result.push(...custom);
      }
    }

    this.orderbag.set(result);
    return result;
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order: ExchangeOrder): void {
    return this.orderbag.triggerOrder(order);
  }

  getOrders(): Promise<ExchangeOrder[]> {
    return this.orderbag.getOrders();
  }

  findOrderById(id: string | number): Promise<ExchangeOrder | undefined> {
    return this.orderbag.findOrderById(id);
  }

  getOrdersForSymbol(symbol: string): Promise<ExchangeOrder[]> {
    return this.orderbag.getOrdersForSymbol(symbol);
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
    const cancelOrder = await this.cancelOrder(id);
    if (!cancelOrder) {
      this.logger.error(`${this.ccxtClient.name}: updateOrder order abort existing order not canceled: ${id}`);
      return undefined;
    }

    return this.createOrder(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount));
  }

  async cancelOrder(id: string | number): Promise<ExchangeOrder | undefined> {
    const order = await this.findOrderById(id);
    if (!order) {
      return undefined;
    }

    let args: CancelOrderArgs = {
      id: id,
      symbol: order.symbol,
      order: order
    };

    if (this.callbacks && this.callbacks.cancelOrder) {
      const custom = this.callbacks.cancelOrder(this.ccxtClient, args);

      if (custom) {
        args = _.merge(args, custom);
      }
    }

    try {
      await this.ccxtClient.cancelOrder(args.id as string, args.symbol);
    } catch (e) {
      if (String(e).includes('OrderNotFound')) {
        this.logger.info(`${this.ccxtClient.name}: order to cancel not found: ${args.id} - ${e}`);
        this.orderbag.delete(id);
      } else {
        this.logger.error(`${this.ccxtClient.name}: cancel order error: ${args.id} - ${e}`);
      }

      return undefined;
    }

    this.orderbag.delete(id);

    return ExchangeOrder.createCanceled(order);
  }

  async cancelAll(symbol: string): Promise<ExchangeOrder[]> {
    const orders: ExchangeOrder[] = [];

    const ordersForSymbol = await this.getOrdersForSymbol(symbol);
    for (const order of ordersForSymbol) {
      const result = await this.cancelOrder(order.id);
      if (result) {
        orders.push(result);
      }
    }

    return orders;
  }

  triggerPlainOrder(plainOrder: any): void {
    const ccxtOrder = this.ccxtClient.parseOrder(plainOrder);
    const exchangeOrder = this.convertOrder(ccxtOrder);

    this.triggerOrder(exchangeOrder);
  }

  convertOrder(ccxtOrder: any): ExchangeOrder {
    if (this.callbacks && this.callbacks.convertOrder) {
      this.callbacks.convertOrder(this.ccxtClient, ccxtOrder);
    }

    return CcxtUtil.createExchangeOrder(ccxtOrder);
  }

  static createEmpty(logger: Logger): CcxtExchangeOrder {
    const Empty = class extends CcxtExchangeOrder {
      constructor(myLogger: Logger) {
        super(undefined as any, [], myLogger);
      }

      async createOrder(order: Order): Promise<ExchangeOrder | undefined> {
        logger.info(`Empty CCXT state: createOrder stopped`);
        return undefined;
      }

      async syncOrders(): Promise<ExchangeOrder[] | undefined> {
        logger.info(`Empty CCXT state: syncOrders stopped`);
        return [];
      }

      async updateOrder(id: string | number, order: Partial<Pick<Order, 'amount' | 'price'>>): Promise<ExchangeOrder | undefined> {
        logger.info(`Empty CCXT state: updateOrder stopped`);
        return undefined;
      }

      async cancelOrder(id: string | number): Promise<ExchangeOrder | undefined> {
        logger.info(`Empty CCXT state: cancelOrder stopped`);
        return undefined;
      }
    };

    return new Empty(logger);
  }
}

export default CcxtExchangeOrder;
