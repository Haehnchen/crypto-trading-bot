import _ from 'lodash';
import { Order } from '../../../dict/order';

export interface PlaceOrder {
  side: 'long' | 'short';
  amount_currency: number;
  price: number;
}

export class SignalResult {
  private _debug: Record<string, any>;
  private _signal?: 'long' | 'short' | 'close';
  public placeOrders: PlaceOrder[];

  constructor() {
    this._debug = {};
    this._signal = undefined;
    this.placeOrders = [];
  }

  mergeDebug(debug: Record<string, any>): void {
    this._debug = _.merge(this._debug, debug);
  }

  setSignal(signal: 'long' | 'short' | 'close'): void {
    if (!['long', 'short', 'close'].includes(signal)) {
      throw `Invalid signal:${signal}`;
    }

    this._signal = signal;
  }

  addDebug(key: string, value: any): void {
    if (typeof key !== 'string') {
      throw 'Invalid key';
    }

    this._debug[key] = value;
  }

  getDebug(): Record<string, any> {
    return this._debug;
  }

  getSignal(): 'long' | 'short' | 'close' | undefined {
    return this._signal;
  }

  placeBuyOrder(amountCurrency: number, price: number): void {
    this.placeOrders.push({
      side: Order.SIDE_LONG,
      amount_currency: amountCurrency,
      price: price
    });
  }

  /**
   *
   * @returns {[Order]}
   */
  getPlaceOrder(): PlaceOrder[] {
    return this.placeOrders;
  }

  static createSignal(signal: 'long' | 'short' | 'close', debug: Record<string, any> = {}): SignalResult {
    const result = new SignalResult();

    result.setSignal(signal);
    result.mergeDebug(debug);

    return result;
  }

  static createEmptySignal(debug: Record<string, any> = {}): SignalResult {
    const result = new SignalResult();

    result.mergeDebug(debug);

    return result;
  }
}
