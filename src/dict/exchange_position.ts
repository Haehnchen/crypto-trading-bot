import { Position } from './position';

export class ExchangePosition {
  constructor(
    private readonly _exchange: string,
    private readonly _position: Position
  ) {
    if (!(_position instanceof Position)) {
      throw new Error(`TypeError: invalid position`);
    }
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
