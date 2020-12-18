/**
 * Order that coming from exchange that is placed there
 */
module.exports = class ExchangeOrder {
  static get STATUS_OPEN() {
    return 'open';
  }

  static get STATUS_DONE() {
    return 'done';
  }

  static get STATUS_CANCELED() {
    return 'canceled';
  }

  static get STATUS_REJECTED() {
    return 'rejected';
  }

  static get TYPE_LIMIT() {
    return 'limit';
  }

  static get TYPE_STOP() {
    return 'stop';
  }

  // think use market
  static get TYPE_STOP_LIMIT() {
    return 'stop_limit';
  }

  static get TYPE_MARKET() {
    return 'market';
  }

  static get TYPE_UNKNOWN() {
    return 'unknown';
  }

  static get SIDE_SHORT() {
    return 'short';
  }

  static get SIDE_LONG() {
    return 'long';
  }

  static get TYPE_TRAILING_STOP() {
    return 'trailing_stop';
  }

  constructor(
    id,
    symbol,
    status,
    price,
    amount,
    retry,
    ourId,
    side,
    type,
    createdAt,
    updatedAt,
    raw = undefined,
    options = {}
  ) {
    if (side !== 'buy' && side !== 'sell') {
      throw `Invalid order direction given:${side}`;
    }

    if (
      ![
        ExchangeOrder.TYPE_LIMIT,
        ExchangeOrder.TYPE_STOP_LIMIT,
        ExchangeOrder.TYPE_MARKET,
        ExchangeOrder.TYPE_UNKNOWN,
        ExchangeOrder.TYPE_STOP,
        ExchangeOrder.TYPE_TRAILING_STOP
      ].includes(type)
    ) {
      throw `Invalid order type: ${type}`;
    }

    this.id = id;
    this.symbol = symbol;
    this.status = status;
    this.price = price;
    this.amount = amount;
    this.retry = retry;
    this.ourId = ourId;
    this.side = side;
    this.type = type;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
    this.raw = raw;
    this.options = options;
  }

  getType() {
    return this.type;
  }

  getSymbol() {
    return this.symbol;
  }

  isReduceOnly() {
    return this.options.reduce_only && this.options.reduce_only === true;
  }

  isPostOnly() {
    return this.options.post_only && this.options.post_only === true;
  }

  isLong() {
    return this.getLongOrShortSide() === 'long';
  }

  isShort() {
    return this.getLongOrShortSide() === 'short';
  }

  getLongOrShortSide() {
    switch (this.side) {
      case 'buy':
        return 'long';
      case 'sell':
        return 'short';
    }

    throw `Invalid side:${this.side}`;
  }

  shouldCancelOrderProcess() {
    return ['canceled', 'rejected'].includes(this.status) && this.retry === false;
  }

  static createBlankRetryOrder(side) {
    return new ExchangeOrder(
      Math.round(new Date().getTime().toString() * Math.random()),
      undefined,
      'canceled',
      undefined,
      undefined,
      true,
      undefined,
      side,
      undefined,
      new Date(),
      new Date()
    );
  }

  static createCanceled(order) {
    return new ExchangeOrder(
      order.id,
      order.symbol,
      'canceled',
      order.price,
      order.amount,
      false,
      order.ourId,
      order.side,
      order.type,
      order.createdAt,
      order.updatedAt,
      order.raw
    );
  }

  static createCanceledFromOrder(order) {
    let { side } = order;
    if (order.side === 'long') {
      side = 'buy';
    } else if (order.side === 'short') {
      side = 'sell';
    }

    return new ExchangeOrder(
      order.id,
      order.symbol,
      'canceled',
      order.price,
      order.amount,
      false,
      order.ourId,
      side,
      order.type
    );
  }

  static createRejectedFromOrder(order, message = undefined) {
    let { side } = order;
    if (order.side === 'long') {
      side = 'buy';
    } else if (order.side === 'short') {
      side = 'sell';
    }

    const raw = {};
    if (message) {
      raw.message = message;
    }

    return new ExchangeOrder(
      order.id,
      order.symbol,
      'rejected',
      order.price,
      order.amount,
      false,
      order.ourId,
      side,
      order.type,
      raw
    );
  }
};
