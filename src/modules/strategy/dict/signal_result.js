const _ = require('lodash');

const Order = require('../../../dict/order');

module.exports = class SignalResult {
  constructor() {
    this._debug = {};
    this._signal = undefined;
    this.placeOrders = [];
  }

  mergeDebug(debug) {
    this._debug = _.merge(this._debug, debug);
  }

  setSignal(signal) {
    if (!['long', 'short', 'close'].includes(signal)) {
      throw `Invalid signal:${signal}`;
    }

    this._signal = signal;
  }

  addDebug(key, value) {
    if (typeof key !== 'string') {
      throw 'Invalid key';
    }

    this._debug[key] = value;
  }

  getDebug() {
    return this._debug;
  }

  getSignal() {
    return this._signal;
  }

  placeBuyOrder(amountCurrency, price) {
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
  getPlaceOrder() {
    return this.placeOrders;
  }

  static createSignal(signal, debug = {}) {
    const result = new SignalResult();

    result.setSignal(signal);
    result.mergeDebug(debug);

    return result;
  }

  static createEmptySignal(debug = {}) {
    const result = new SignalResult();

    result.mergeDebug(debug);

    return result;
  }
};
