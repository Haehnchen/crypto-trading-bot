import { ExchangeOrder } from '../../dict/exchange_order';

export class OrderBag {
  private orders: Record<string, ExchangeOrder>;

  constructor() {
    this.orders = {};
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order: ExchangeOrder): void {
    if (!(order instanceof ExchangeOrder)) {
      throw Error('Invalid order given');
    }

    // dont overwrite state closed order
    for (const [key] of Object.entries(this.orders)) {
      if (String(order.id) !== String(key)) {
        continue;
      }

      if (
        [ExchangeOrder.STATUS_DONE, ExchangeOrder.STATUS_CANCELED, ExchangeOrder.STATUS_REJECTED].includes(order.status)
      ) {
        delete this.orders[order.id];
      }
      break;
    }

    this.orders[String(order.id)] = order;
  }

  getOrders(): Promise<ExchangeOrder[]> {
    return new Promise(resolve => {
      const orders: ExchangeOrder[] = [];

      for (const key in this.orders) {
        if (this.orders[key].status === 'open') {
          orders.push(this.orders[key]);
        }
      }

      resolve(orders);
    });
  }

  findOrderById(id: string | number): Promise<ExchangeOrder | undefined> {
    return new Promise(async resolve => {
      resolve((await this.getOrders()).find(order => order.id === id || order.id == id));
    });
  }

  getOrdersForSymbol(symbol: string): Promise<ExchangeOrder[]> {
    return new Promise(async resolve => {
      resolve((await this.getOrders()).filter(order => order.symbol === symbol));
    });
  }

  delete(id: string | number): void {
    delete this.orders[String(id)];
  }

  set(orders: ExchangeOrder[]): void {
    const ourOrder: Record<string, ExchangeOrder> = {};

    orders.forEach(o => {
      if (!(o instanceof ExchangeOrder)) {
        throw Error('Invalid order given');
      }

      ourOrder[String(o.id)] = o;
    });

    this.orders = ourOrder;
  }

  get(id: string | number): ExchangeOrder | undefined {
    return this.orders[String(id)];
  }

  all(): ExchangeOrder[] {
    return Object.values(this.orders);
  }
}
