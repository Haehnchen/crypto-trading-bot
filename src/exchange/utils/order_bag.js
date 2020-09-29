const ExchangeOrder = require('../../dict/exchange_order');

module.exports = class OrderBag {
  constructor() {
    this.orders = {};
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order) {
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

  delete(id) {
    delete this.orders[String(id)];
  }

  set(orders) {
    const ourOrder = {};

    orders.forEach(o => {
      if (!(o instanceof ExchangeOrder)) {
        throw Error('Invalid order given');
      }

      ourOrder[String(o.id)] = o;
    });

    this.orders = ourOrder;
  }

  get(id) {
    return this.orders[String(id)];
  }

  all() {
    return Object.values(this.orders);
  }
};
