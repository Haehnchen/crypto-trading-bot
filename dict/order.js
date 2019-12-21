const _ = require('lodash');

/**
 * The order that should place from our side and sending to remote
 *
 * @type {module.Order}
 */
module.exports = class Order {
  constructor(id, symbol, side, price, amount, type, options = {}) {
    this.id = id;
    this.symbol = symbol;
    this.side = side;
    this.price = price;
    this.amount = amount;
    this.type = type;
    this.options = options;
  }

  hasAdjustedPrice() {
    return this.options.adjust_price === true;
  }

  static createMarketOrder(symbol, amount) {
    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      amount > 0 ? 'long' : 'short',
      amount > 0 ? 0.000001 : -0.000001, // fake prices
      amount,
      'market'
    );
  }

  static createLimitPostOnlyOrder(symbol, side, price, amount, options) {
    if (side !== 'long' && side !== 'short') {
      throw `Invalid order side:${side} - ${JSON.stringify([symbol, side, price, amount, options])}`;
    }

    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      side,
      price,
      amount,
      'limit',
      _.merge(options, {
        post_only: true
      })
    );
  }

  static createStopOrder(symbol, side, price, amount, options) {
    if (side !== 'long' && side !== 'short') {
      throw `Invalid order side:${side} - ${JSON.stringify([symbol, side, price, amount, options])}`;
    }

    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      side,
      price,
      amount,
      'stop',
      options
    );
  }

  static createLimitPostOnlyOrderAutoSide(symbol, price, amount, options) {
    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      price < 0 ? 'short' : 'long',
      price,
      amount,
      'limit',
      _.merge(options, {
        post_only: true
      })
    );
  }

  static createCloseLimitPostOnlyReduceOrder(symbol, price, amount) {
    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      price < 0 ? 'short' : 'long',
      price,
      amount,
      'limit',
      {
        post_only: true,
        close: true
      }
    );
  }

  static createLimitPostOnlyOrderAutoAdjustedPriceOrder(symbol, amount, options = {}) {
    return Order.createLimitPostOnlyOrder(
      symbol,
      amount < 0 ? 'short' : 'long',
      undefined,
      amount,
      _.merge(options, {
        adjust_price: true
      })
    );
  }

  static createRetryOrder(order, amount) {
    if (!order instanceof Order) {
      throw 'TypeError: no Order';
    }

    if (order.side !== 'long' && order.side !== 'short') {
      throw `Invalid order side:${order.side} - ${JSON.stringify(order)}`;
    }

    let orderAmount = order.amount;
    if (typeof amount !== 'undefined') {
      orderAmount = Math.abs(amount);

      if (order.side === 'short') {
        orderAmount *= -1;
      }
    }

    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      order.symbol,
      order.side,
      order.price,
      orderAmount,
      order.type,
      order.options
    );
  }

  static createRetryOrderWithPriceAdjustment(order, price) {
    if (!(order instanceof Order)) {
      throw 'TypeError: no Order';
    }

    if (order.side !== 'long' && order.side !== 'short') {
      throw `Invalid order side:${order.side} - ${JSON.stringify(order)}`;
    }

    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      order.symbol,
      order.side,
      price,
      order.amount,
      order.type,
      order.options
    );
  }

  static createPriceUpdateOrder(id, price) {
    return new Order(id, undefined, undefined, price, undefined, undefined, undefined);
  }

  static createStopLossOrder(symbol, price, amount) {
    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      undefined,
      price,
      amount,
      'stop',
      { close: true }
    );
  }

  static createCloseOrderWithPriceAdjustment(symbol, amount) {
    return Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder(symbol, amount, { close: true });
  }

  static createUpdateOrderOnCurrent(order, price = undefined, amount = undefined) {
    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      order.symbol,
      order.side,
      typeof price === 'undefined' ? order.price : price,
      typeof amount === 'undefined' ? order.amount : amount,
      order.type,
      order.options
    );
  }
};
