const Order = require('./order');
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

  constructor(exchange, symbol, state, options, adjustedPrice) {
    if (![PairState.STATE_LONG, PairState.STATE_SHORT, PairState.STATE_CLOSE, PairState.STATE_CANCEL].includes(state)) {
      throw `Invalidate state: ${state}`;
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

  getOptions() {
    return this.options;
  }

  getTime() {
    return this.time;
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

  triggerRetry() {
    return (this.retries += 1);
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
