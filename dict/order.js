const _ = require('lodash');

/**
 * The order that should place from our side and sending to remote
 */
module.exports = class Order {
  static get SIDE_LONG() {
    return 'long';
  }

  static get SIDE_SHORT() {
    return 'short';
  }

  static get TYPE_LIMIT() {
    return 'limit';
  }

  static get TYPE_STOP() {
    return 'stop';
  }

  static get TYPE_MARKET() {
    return 'market';
  }

  static get OPTION_POST_ONLY() {
    return 'post_only';
  }

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

  getId() {
    return this.id;
  }

  getSymbol() {
    return this.symbol;
  }

  isShort() {
    return this.side === Order.SIDE_SHORT;
  }

  isLong() {
    return this.side === Order.SIDE_LONG;
  }

  getPrice() {
    return Math.abs(this.price);
  }

  getAmount() {
    return Math.abs(this.amount);
  }

  getType() {
    return this.type;
  }

  isPostOnly() {
    return this.options && this.options.post_only === true;
  }

  static createMarketOrder(symbol, amount) {
    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      amount > 0 ? Order.SIDE_LONG : Order.SIDE_SHORT,
      amount > 0 ? 0.000001 : -0.000001, // fake prices
      amount,
      'market'
    );
  }

  static createLimitPostOnlyOrder(symbol, side, price, amount, options) {
    if (![Order.SIDE_SHORT, Order.SIDE_LONG].includes(side)) {
      throw `Invalid order side:${side} - ${JSON.stringify([symbol, side, price, amount, options])}`;
    }

    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      side,
      price,
      amount,
      Order.TYPE_LIMIT,
      _.merge(options, {
        post_only: true
      })
    );
  }

  static createStopOrder(symbol, side, price, amount, options) {
    if (![Order.SIDE_SHORT, Order.SIDE_LONG].includes(side)) {
      throw `Invalid order side:${side} - ${JSON.stringify([symbol, side, price, amount, options])}`;
    }

    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      side,
      price,
      amount,
      Order.TYPE_STOP,
      options
    );
  }

  static createLimitPostOnlyOrderAutoSide(symbol, price, amount, options) {
    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      price < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
      price,
      amount,
      Order.TYPE_LIMIT,
      _.merge(options, {
        post_only: true
      })
    );
  }

  static createCloseLimitPostOnlyReduceOrder(symbol, price, amount) {
    return new Order(
      Math.round(new Date().getTime().toString() * Math.random()),
      symbol,
      price < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
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
      amount < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
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

    if (![Order.SIDE_SHORT, Order.SIDE_LONG].includes(order.side)) {
      throw `Invalid order side:${order.side} - ${JSON.stringify(order)}`;
    }

    let orderAmount = order.amount;
    if (typeof amount !== 'undefined') {
      orderAmount = Math.abs(amount);

      if (order.side === Order.SIDE_SHORT) {
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

    if (![Order.SIDE_SHORT, Order.SIDE_LONG].includes(order.side)) {
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
      price < 0 || amount < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
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
