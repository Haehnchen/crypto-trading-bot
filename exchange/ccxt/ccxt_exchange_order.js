const ccxt = require('ccxt');
const OrderBag = require('../utils/order_bag');
const Order = require('../../dict/order');
const ExchangeOrder = require('../../dict/exchange_order');
const CcxtUtil = require('../utils/ccxt_util');

module.exports = class CcxtExchangeOrder {
  constructor(ccxtClient, symbols, logger, callbacks) {
    this.orderbag = new OrderBag();
    this.symbols = symbols;
    this.logger = logger;
    this.ccxtClient = ccxtClient;
    this.callbacks = callbacks;
  }

  async createOrder(order) {
    const side = order.isShort() ? 'sell' : 'buy';

    let promise;
    switch (order.getType()) {
      case 'stop':
      case 'limit':
        promise = this.ccxtClient.createOrder(
          order.getSymbol(),
          order.getType(),
          side,
          order.getAmount(),
          order.getPrice()
        );
        break;
      case 'market':
        promise = this.ccxtClient.createOrder(order.getSymbol(), order.getType(), side, order.getAmount());
        break;
      default:
        throw `Ccxt order converter unsupported order type:${order.getType()}`;
    }

    let placedOrder;
    try {
      placedOrder = await promise;
    } catch (e) {
      if (e instanceof ccxt.NetworkError) {
        return undefined;
      }

      throw e;
    }

    let exchangeOrder;
    try {
      exchangeOrder = await CcxtUtil.createExchangeOrder(placedOrder);
    } catch (e) {
      this.logger.error(`CCXT order place issue: ${JSON.stringify(e)}`);
      return undefined;
    }

    this.triggerOrder(exchangeOrder);
    return exchangeOrder;
  }

  async syncOrders() {
    let orders;
    try {
      orders = await this.ccxtClient.fetchOpenOrders();
    } catch (e) {
      this.logger.err(`SyncOrder timeout: ${String(e)}`);
      return undefined;
    }

    const result = CcxtUtil.createExchangeOrders(orders);

    if ('syncOrders' in this.callbacks) {
      let custom;
      try {
        custom = await this.callbacks.syncOrders(this.ccxtClient);
      } catch (e) {
        this.logger.err(`SyncOrder callback error: ${String(e)}`);
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

    return await this.createOrder(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount));
  }

  async cancelOrder(id) {
    const order = await this.findOrderById(id);
    if (!order) {
      return;
    }

    try {
      await this.ccxtClient.cancelOrder(id);
    } catch (e) {
      this.logger.error(`${this.ccxtClient.name}: cancel order error: ${e}`);
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
};
