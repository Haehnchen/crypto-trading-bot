import { Order } from './order';
import { OrderCapital } from './order_capital';
import { ExchangeOrder } from './exchange_order';

export type PairStateType = 'long' | 'short' | 'close' | 'cancel';

export type ClearCallback = () => void;

export class PairState {
  static readonly STATE_LONG: PairStateType = 'long';
  static readonly STATE_SHORT: PairStateType = 'short';
  static readonly STATE_CLOSE: PairStateType = 'close';
  static readonly STATE_CANCEL: PairStateType = 'cancel';

  time: Date;
  capital?: OrderCapital;
  order?: Order;
  exchangeOrder?: ExchangeOrder;
  retries: number;
  cleared: boolean;

  /**
   * @param exchange String
   * @param symbol String
   * @param capital {OrderCapital}
   * @param options
   * @param adjustedPrice bool
   * @param clearCallback
   * @returns {PairState}
   */
  static createLong(
    exchange: string,
    symbol: string,
    capital: OrderCapital,
    options?: any,
    adjustedPrice?: boolean,
    clearCallback?: ClearCallback
  ): PairState {
    if (!(capital instanceof OrderCapital)) {
      throw new Error('TypeError: invalid OrderCapital');
    }

    const state = new PairState(exchange, symbol, PairState.STATE_LONG, options, adjustedPrice, clearCallback!);
    state.capital = capital;
    return state;
  }

  /**
   * @param exchange String
   * @param symbol String
   * @param capital {OrderCapital}
   * @param options
   * @param adjustedPrice bool
   * @param clearCallback
   * @returns {PairState}
   */
  static createShort(
    exchange: string,
    symbol: string,
    capital: OrderCapital,
    options?: any,
    adjustedPrice?: boolean,
    clearCallback?: ClearCallback
  ): PairState {
    if (!(capital instanceof OrderCapital)) {
      throw new Error('TypeError: invalid OrderCapital');
    }

    const state = new PairState(exchange, symbol, PairState.STATE_SHORT, options, adjustedPrice, clearCallback!);
    state.capital = capital;
    return state;
  }

  constructor(
    public exchange: string,
    public symbol: string,
    public state: PairStateType,
    public options?: any,
    public adjustedPrice: boolean = false,
    public clearCallback: ClearCallback = () => {}
  ) {
    if (![PairState.STATE_LONG, PairState.STATE_SHORT, PairState.STATE_CLOSE, PairState.STATE_CANCEL].includes(state)) {
      throw new Error(`Invalidate state: ${state}`);
    }

    if (typeof clearCallback !== 'function') {
      throw new Error(`clearCallback not given`);
    }

    this.time = new Date();
    this.retries = 0;
    this.cleared = false;
  }

  getExchange(): string {
    return this.exchange;
  }

  hasAdjustedPrice(): boolean {
    return this.adjustedPrice;
  }

  getSymbol(): string {
    return this.symbol;
  }

  getState(): PairStateType {
    return this.state;
  }

  clear(): any {
    this.cleared = true;
    return this.clearCallback();
  }

  getOptions(): any {
    return this.options;
  }

  getTime(): Date {
    return this.time;
  }

  isCleared(): boolean {
    return this.cleared;
  }

  getOrder(): Order | undefined {
    return this.order;
  }

  getRetries(): number {
    return this.retries;
  }

  getCapital(): OrderCapital | undefined {
    return this.capital;
  }

  triggerRetry(): void {
    this.retries += 1;
  }

  setOrder(order?: Order): void {
    if (order && !(order instanceof Order)) {
      throw 'TypeError: no Order';
    }

    this.order = order;
  }

  getExchangeOrder(): ExchangeOrder | undefined {
    return this.exchangeOrder;
  }

  setExchangeOrder(exchangeOrder?: ExchangeOrder): void {
    if (exchangeOrder && !(exchangeOrder instanceof ExchangeOrder)) {
      throw 'TypeError: no exchangeOrder';
    }

    this.exchangeOrder = exchangeOrder;
  }
}
