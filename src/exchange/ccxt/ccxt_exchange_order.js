const ccxt = require('ccxt');
const _ = require('lodash');
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

    let parameters = {};

    if (this.callbacks && 'createOrder' in this.callbacks) {
      const custom = this.callbacks.createOrder(order);

      if (custom) {
        parameters = _.merge(parameters, custom);
      }
    }

    let promise;
    switch (order.getType()) {
      case Order.TYPE_STOP:
      case Order.TYPE_LIMIT:
        promise = this.ccxtClient.createOrder(
          order.getSymbol(),
          order.getType(),
          side,
          order.getAmount(),
          order.getPrice(),
          parameters.args || undefined
        );
        break;
      case Order.TYPE_MARKET:
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

    const exchangeOrder = this.convertOrder(placedOrder);
    this.triggerOrder(exchangeOrder);
    return exchangeOrder;
  }

  async syncOrders() {
    let orders;
    try {
      orders = await this.ccxtClient.fetchOpenOrders();
    } catch (e) {
      this.logger.error(`SyncOrder timeout: ${String(e)}`);
      return undefined;
    }

    if (this.callbacks && 'convertOrder' in this.callbacks) {
      orders.forEach(o => {
        this.callbacks.convertOrder(this.ccxtClient, o);
      });
    }

    const result = CcxtUtil.createExchangeOrders(orders);

    if (this.callbacks && 'syncOrders' in this.callbacks) {
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

  async cancelOrder(id) {
    const order = await this.findOrderById(id);
    if (!order) {
      return undefined;
    }

    let args = {
      id: id,
      symbol: order.symbol,
      order: order
    };

    if (this.callbacks && 'cancelOrder' in this.callbacks) {
      const custom = this.callbacks.cancelOrder(this.ccxtClient, args);

      if (custom) {
        args = _.merge(args, custom);
      }
    }

    try {
      await this.ccxtClient.cancelOrder(args.id, args.symbol);
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

  async cancelAll(symbol) {
    const orders = [];

    for (const order of await this.getOrdersForSymbol(symbol)) {
      orders.push(await this.cancelOrder(order.id));
    }

    return orders;
  }

  triggerPlainOrder(plainOrder) {
    const ccxtOrder = this.ccxtClient.parseOrder(plainOrder);
    const exchangeOrder = this.convertOrder(ccxtOrder);

    this.triggerOrder(exchangeOrder);
  }

  convertOrder(ccxtOrder) {
    if (this.callbacks && 'convertOrder' in this.callbacks) {
      this.callbacks.convertOrder(this.ccxtClient, ccxtOrder);
    }

    return CcxtUtil.createExchangeOrder(ccxtOrder);
  }

  static createEmpty(logger) {
    const Empty = class extends CcxtExchangeOrder {
      constructor(myLogger) {
        super(undefined, undefined, myLogger);
      }

      async createOrder(order) {
        logger.info(`Empty CCXT state: createOrder stopped`);
        return undefined;
      }

      async syncOrders() {
        logger.info(`Empty CCXT state: syncOrders stopped`);
        return [];
      }

      async updateOrder(id, order) {
        logger.info(`Empty CCXT state: updateOrder stopped`);
        return [];
      }

      async cancelOrder(id) {
        logger.info(`Empty CCXT state: cancelOrder stopped`);
        return [];
      }
    };

    return new Empty(logger);
  }
};
