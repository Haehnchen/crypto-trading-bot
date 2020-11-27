const Order = require('./order');
const OrderCapital = require('./order_capital');
const ExchangeOrder = require('./exchange_order');

module.exports = class PairState {
  static get STATE_LONG() {
    return 'long';
  }

  static get STATE_SHORT() {
    return 'short';
  }

  static get STATE_CLOSE() {
    return 'close';
  }

  static get STATE_CANCEL() {
    return 'cancel';
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
  static createLong(exchange, symbol, capital, options, adjustedPrice, clearCallback) {
    if (!(capital instanceof OrderCapital)) {
      throw new Error('TypeError: invalid OrderCapital');
    }

    const state = new PairState(exchange, symbol, PairState.STATE_LONG, options, adjustedPrice, clearCallback);
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
  static createShort(exchange, symbol, capital, options, adjustedPrice, clearCallback) {
    if (!(capital instanceof OrderCapital)) {
      throw new Error('TypeError: invalid OrderCapital');
    }

    const state = new PairState(exchange, symbol, PairState.STATE_SHORT, options, adjustedPrice, clearCallback);
    state.capital = capital;
    return state;
  }

  constructor(exchange, symbol, state, options, adjustedPrice, clearCallback) {
    if (![PairState.STATE_LONG, PairState.STATE_SHORT, PairState.STATE_CLOSE, PairState.STATE_CANCEL].includes(state)) {
      throw new Error(`Invalidate state: ${state}`);
    }

    if (typeof clearCallback !== 'function') {
      throw new Error(`clearCallback not given`);
    }

    this.time = new Date();
    this.exchange = exchange;
    this.symbol = symbol;
    this.state = state;
    this.options = options;
    this.order = undefined;
    this.exchangeOrder = undefined;
    this.retries = 0;
    this.adjustedPrice = adjustedPrice;
    this.clearCallback = clearCallback;
    this.cleared = false;
  }

  /**
   * @returns {string}
   */
  getExchange() {
    return this.exchange;
  }

  /**
   * @returns {boolean}
   */
  hasAdjustedPrice() {
    return this.adjustedPrice;
  }

  /**
   * @returns {string}
   */
  getSymbol() {
    return this.symbol;
  }

  /**
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  clear() {
    this.cleared = true;
    return this.clearCallback();
  }

  getOptions() {
    return this.options;
  }

  getTime() {
    return this.time;
  }

  /**
   * @returns {boolean}
   */
  isCleared() {
    return this.cleared;
  }

  /**
   *
   * @returns {Order|undefined}
   */
  getOrder() {
    return this.order;
  }

  getRetries() {
    return this.retries;
  }

  getCapital() {
    return this.capital;
  }

  triggerRetry() {
    this.retries += 1;
  }

  /**
   * @param order {Order|undefined}
   */
  setOrder(order) {
    if (order && !order instanceof Order) {
      throw 'TypeError: no Order';
    }

    this.order = order;
  }

  /**
   *
   * @returns {ExchangeOrder|undefined}
   */
  getExchangeOrder() {
    return this.exchangeOrder;
  }

  /**
   * @param exchangeOrder {ExchangeOrder|undefined}
   */
  setExchangeOrder(exchangeOrder) {
    if (exchangeOrder && !exchangeOrder instanceof ExchangeOrder) {
      throw 'TypeError: no exchangeOrder';
    }

    this.exchangeOrder = exchangeOrder;
  }
};
