const Position = require('./position');

module.exports = class ExchangePosition {
  constructor(exchange, position) {
    if (!(position instanceof Position)) {
      throw new Error(`TypeError: invalid position`);
    }

    this._exchange = exchange;
    this._position = position;
  }

  getKey() {
    return this._exchange + this._position.getSymbol() + this._position.getSide();
  }

  getExchange() {
    return this._exchange;
  }

  getPosition() {
    return this._position;
  }

  getSymbol() {
    return this._position.getSymbol();
  }
};
