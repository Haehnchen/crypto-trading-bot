import { Position } from './position';

export class ExchangePosition {
  private readonly _exchange: string;
  private readonly _position: Position;

  constructor(exchange: string, position: Position) {
    if (!(position instanceof Position)) {
      throw new Error(`TypeError: invalid position`);
    }

    this._exchange = exchange;
    this._position = position;
  }

  getKey(): string {
    return this._exchange + this._position.symbol;
  }

  getExchange(): string {
    return this._exchange;
  }

  getPosition(): Position {
    return this._position;
  }

  getSymbol(): string {
    return this._position.getSymbol();
  }
}
