export type ExchangeOrderStatus = 'open' | 'done' | 'canceled' | 'rejected';
export type ExchangeOrderType = 'limit' | 'stop' | 'stop_limit' | 'market' | 'unknown' | 'trailing_stop';
export type ExchangeOrderSide = 'buy' | 'sell';
export type ExchangeOrderSideLongShort = 'long' | 'short';

export interface ExchangeOrderOptions {
  reduce_only?: boolean;
  post_only?: boolean;
  [key: string]: any;
}

/**
 * Order that coming from exchange that is placed there
 */
export class ExchangeOrder {
  static readonly STATUS_OPEN: ExchangeOrderStatus = 'open';
  static readonly STATUS_DONE: ExchangeOrderStatus = 'done';
  static readonly STATUS_CANCELED: ExchangeOrderStatus = 'canceled';
  static readonly STATUS_REJECTED: ExchangeOrderStatus = 'rejected';

  static readonly TYPE_LIMIT: ExchangeOrderType = 'limit';
  static readonly TYPE_STOP: ExchangeOrderType = 'stop';
  static readonly TYPE_STOP_LIMIT: ExchangeOrderType = 'stop_limit';
  static readonly TYPE_MARKET: ExchangeOrderType = 'market';
  static readonly TYPE_UNKNOWN: ExchangeOrderType = 'unknown';
  static readonly TYPE_TRAILING_STOP: ExchangeOrderType = 'trailing_stop';

  static readonly SIDE_SHORT: ExchangeOrderSideLongShort = 'short';
  static readonly SIDE_LONG: ExchangeOrderSideLongShort = 'long';

  id: string | number;
  symbol: string;
  status: ExchangeOrderStatus;
  price: number;
  amount: number;
  retry: boolean;
  ourId: string | number | undefined;
  side: ExchangeOrderSide;
  type: ExchangeOrderType;
  createdAt: Date;
  updatedAt: Date;
  raw?: any;
  options: ExchangeOrderOptions;

  constructor(
    id: string | number,
    symbol: string,
    status: ExchangeOrderStatus,
    price: number,
    amount: number,
    retry: boolean,
    ourId?: string | number,
    side?: ExchangeOrderSide,
    type?: ExchangeOrderType,
    createdAt?: Date,
    updatedAt?: Date,
    raw?: any,
    options: ExchangeOrderOptions = {}
  ) {
    if (side && side !== 'buy' && side !== 'sell') {
      throw `Invalid order direction given:${side}`;
    }

    if (
      type &&
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
    this.side = side || 'buy';
    this.type = type || 'unknown';
    this.createdAt = createdAt || new Date();
    this.updatedAt = updatedAt || new Date();
    this.raw = raw;
    this.options = options;
  }

  getType(): ExchangeOrderType {
    return this.type;
  }

  getSymbol(): string {
    return this.symbol;
  }

  isReduceOnly(): boolean {
    return this.options.reduce_only === true;
  }

  isPostOnly(): boolean {
    return this.options.post_only === true;
  }

  isLong(): boolean {
    return this.getLongOrShortSide() === 'long';
  }

  isShort(): boolean {
    return this.getLongOrShortSide() === 'short';
  }

  getStatus(): ExchangeOrderStatus {
    return this.status;
  }

  getLongOrShortSide(): ExchangeOrderSideLongShort {
    switch (this.side) {
      case 'buy':
        return 'long';
      case 'sell':
        return 'short';
    }

    throw `Invalid side:${this.side}`;
  }

  shouldCancelOrderProcess(): boolean {
    return ['canceled', 'rejected'].includes(this.status) && this.retry === false;
  }

  static createBlankRetryOrder(side: ExchangeOrderSide): ExchangeOrder {
    return new ExchangeOrder(
      Math.round(new Date().getTime() * Math.random()),
      '',
      'canceled',
      0,
      0,
      true,
      undefined,
      side,
      undefined,
      new Date(),
      new Date()
    );
  }

  static createCanceled(order: ExchangeOrder): ExchangeOrder {
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

  static createCanceledFromOrder(order: any): ExchangeOrder {
    let side: ExchangeOrderSide = 'buy';
    if (order.side === 'long') {
      side = 'buy';
    } else if (order.side === 'short') {
      side = 'sell';
    }

    return new ExchangeOrder(order.id, order.symbol, 'canceled', order.price, order.amount, false, order.ourId, side, order.type);
  }

  static createRejectedFromOrder(order: any, message?: string): ExchangeOrder {
    let side: ExchangeOrderSide = 'buy';
    if (order.side === 'long') {
      side = 'buy';
    } else if (order.side === 'short') {
      side = 'sell';
    }

    const raw: any = {};
    if (message) {
      raw.message = message;
    }

    return new ExchangeOrder(order.id, order.symbol, 'rejected', order.price, order.amount, false, order.ourId, side, order.type, raw);
  }
}
