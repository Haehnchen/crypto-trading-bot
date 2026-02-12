import _ from 'lodash';

export type OrderSide = 'long' | 'short';
export type OrderType = 'limit' | 'stop' | 'market' | 'trailing_stop';

export interface OrderOptions {
  adjust_price?: boolean;
  post_only?: boolean;
  close?: boolean;
  [key: string]: any;
}

/**
 * The order that should place from our side and sending to remote
 */
export class Order {
  static readonly SIDE_LONG: OrderSide = 'long';
  static readonly SIDE_SHORT: OrderSide = 'short';

  static readonly TYPE_LIMIT: OrderType = 'limit';
  static readonly TYPE_STOP: OrderType = 'stop';
  static readonly TYPE_MARKET: OrderType = 'market';
  static readonly TYPE_TRAILING_STOP: OrderType = 'trailing_stop';

  static readonly OPTION_POST_ONLY = 'post_only';

  id: string | number;
  symbol: string;
  side: OrderSide;
  price: number;
  amount: number;
  type: OrderType;
  options: OrderOptions;

  constructor(id: string | number, symbol: string, side: OrderSide, price: number, amount: number, type: OrderType, options: OrderOptions = {}) {
    if (![Order.SIDE_LONG, Order.SIDE_SHORT].includes(side)) {
      throw new Error(`Invalid order side given: ${side}`);
    }

    this.id = id;
    this.symbol = symbol;
    this.side = side;
    this.price = price;
    this.amount = amount;
    this.type = type;
    this.options = options;
  }

  hasAdjustedPrice(): boolean {
    return this.options.adjust_price === true;
  }

  getId(): string | number {
    return this.id;
  }

  getSymbol(): string {
    return this.symbol;
  }

  isShort(): boolean {
    return this.side === Order.SIDE_SHORT;
  }

  isLong(): boolean {
    return this.side === Order.SIDE_LONG;
  }

  getPrice(): number | undefined {
    return this.price ? Math.abs(this.price) : undefined;
  }

  getAmount(): number | undefined {
    return this.amount ? Math.abs(this.amount) : undefined;
  }

  getType(): OrderType {
    return this.type;
  }

  isPostOnly(): boolean {
    return this.options && this.options.post_only === true;
  }

  isReduceOnly(): boolean {
    return this.options && this.options.close === true;
  }

  static createMarketOrder(symbol: string, amount: number): Order {
    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      symbol,
      amount > 0 ? Order.SIDE_LONG : Order.SIDE_SHORT,
      amount > 0 ? 0.000001 : -0.000001, // fake prices
      amount,
      this.TYPE_MARKET
    );
  }

  static createLimitPostOnlyOrder(symbol: string, side: OrderSide, price: number, amount: number, options?: OrderOptions): Order {
    if (![Order.SIDE_SHORT, Order.SIDE_LONG].includes(side)) {
      throw new Error(`Invalid order side:${side} - ${JSON.stringify([symbol, side, price, amount, options])}`);
    }

    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      symbol,
      side,
      price,
      amount,
      Order.TYPE_LIMIT,
      _.merge({}, options, {
        post_only: true
      })
    );
  }

  static createStopOrder(symbol: string, side: OrderSide, price: number, amount: number, options?: OrderOptions): Order {
    if (![Order.SIDE_SHORT, Order.SIDE_LONG].includes(side)) {
      throw new Error(`Invalid order side:${side} - ${JSON.stringify([symbol, side, price, amount, options])}`);
    }

    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      symbol,
      side,
      price,
      amount,
      Order.TYPE_STOP,
      options
    );
  }

  static createLimitPostOnlyOrderAutoSide(symbol: string, price: number, amount: number, options?: OrderOptions): Order {
    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      symbol,
      price < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
      price,
      amount,
      Order.TYPE_LIMIT,
      _.merge({}, options, {
        post_only: true,
      })
    );
  }

  static createCloseLimitPostOnlyReduceOrder(symbol: string, price: number, amount: number): Order {
    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      symbol,
      price < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
      price,
      amount,
      this.TYPE_LIMIT,
      {
        post_only: true,
        close: true,
      }
    );
  }

  static createLimitPostOnlyOrderAutoAdjustedPriceOrder(symbol: string, amount: number, options: OrderOptions = {}): Order {
    return Order.createLimitPostOnlyOrder(
      symbol,
      amount < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
      0,
      amount,
      _.merge({}, options, {
        adjust_price: true,
      })
    );
  }

  static createRetryOrder(order: Order, amount?: number): Order {
    if (!(order instanceof Order)) {
      throw new Error('TypeError: no Order');
    }

    if (![Order.SIDE_SHORT, Order.SIDE_LONG].includes(order.side)) {
      throw new Error(`Invalid order side:${order.side} - ${JSON.stringify(order)}`);
    }

    let orderAmount = order.amount;
    if (typeof amount !== 'undefined') {
      orderAmount = Math.abs(amount);

      if (order.side === Order.SIDE_SHORT) {
        orderAmount *= -1;
      }
    }

    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      order.symbol,
      order.side,
      order.price,
      orderAmount,
      order.type,
      order.options
    );
  }

  static createRetryOrderWithPriceAdjustment(order: Order, price: number): Order {
    if (!(order instanceof Order)) {
      throw new Error('TypeError: no Order');
    }

    if (![Order.SIDE_SHORT, Order.SIDE_LONG].includes(order.side)) {
      throw new Error(`Invalid order side:${order.side} - ${JSON.stringify(order)}`);
    }

    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      order.symbol,
      order.side,
      price,
      order.amount,
      order.type,
      order.options
    );
  }

  static createPriceUpdateOrder(id: string | number, price: number, side: OrderSide): Order {
    return new Order(id, '', side, price, 0, Order.TYPE_LIMIT, {});
  }

  static createStopLossOrder(symbol: string, price: number, amount: number): Order {
    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      symbol,
      price < 0 || amount < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
      price,
      amount,
      'stop',
      { close: true }
    );
  }

  static createUpdateOrder(id: string | number, price?: number, amount?: number): Order {
    const side: OrderSide = (price && price < 0) || (amount && amount < 0) ? Order.SIDE_SHORT : Order.SIDE_LONG;
    return new Order(id, '', side, price || 0, amount || 0, Order.TYPE_LIMIT, {});
  }

  static createCloseOrderWithPriceAdjustment(symbol: string, amount: number): Order {
    return Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder(symbol, amount, { close: true });
  }

  static createUpdateOrderOnCurrent(exchangeOrder: any, price?: number, amount?: number): Order {
    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      exchangeOrder.symbol,
      exchangeOrder.getLongOrShortSide(),
      typeof price === 'undefined' ? exchangeOrder.price : price,
      typeof amount === 'undefined' ? exchangeOrder.amount : amount,
      exchangeOrder.type,
      exchangeOrder.options
    );
  }

  static createTrailingStopLossOrder(symbol: string, distance: number, amount: number): Order {
    return new Order(
      Math.round(new Date().getTime() * Math.random()),
      symbol,
      distance < 0 ? Order.SIDE_SHORT : Order.SIDE_LONG,
      distance,
      amount,
      this.TYPE_TRAILING_STOP,
      { close: true }
    );
  }
}
