const ExchangePosition = require('../dict/exchange_position');

module.exports = class PositionStateChangeEvent {
  static get EVENT_NAME() {
    return 'position_state_changed';
  }

  constructor(state, exchangePosition) {
    if (!(exchangePosition instanceof ExchangePosition)) {
      throw 'TypeError: invalid exchangePosition';
    }

    if (!['opened', 'closed'].includes(state)) {
      throw `TypeError: invalid state: ${state}`;
    }

    this._state = state;
    this._exchangePosition = exchangePosition;
  }

  isOpened() {
    return this._state === 'opened';
  }

  isClosed() {
    return this._state === 'closed';
  }

  getExchange() {
    return this._exchangePosition.getExchange();
  }

  getPosition() {
    return this._exchangePosition.getPosition();
  }

  getSymbol() {
    return this._exchangePosition.getSymbol();
  }

  static createOpened(exchangePosition) {
    return new PositionStateChangeEvent('opened', exchangePosition);
  }

  static createClosed(exchangePosition) {
    return new PositionStateChangeEvent('closed', exchangePosition);
  }
};
