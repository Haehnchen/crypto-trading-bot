import { ExchangePosition } from '../dict/exchange_position';
import { Position } from '../dict/position';

export type PositionState = 'opened' | 'closed';

export class PositionStateChangeEvent {
  static readonly EVENT_NAME = 'position_state_changed';

  constructor(
    private readonly _state: PositionState,
    private readonly _exchangePosition: ExchangePosition
  ) {
    if (!(_exchangePosition instanceof ExchangePosition)) {
      throw 'TypeError: invalid exchangePosition';
    }

    if (!['opened', 'closed'].includes(_state)) {
      throw `TypeError: invalid state: ${_state}`;
    }
  }

  isOpened(): boolean {
    return this._state === 'opened';
  }

  isClosed(): boolean {
    return this._state === 'closed';
  }

  getExchange(): string {
    return this._exchangePosition.getExchange();
  }

  getPosition(): Position {
    return this._exchangePosition.getPosition();
  }

  getSymbol(): string {
    return this._exchangePosition.getSymbol();
  }

  static createOpened(exchangePosition: ExchangePosition): PositionStateChangeEvent {
    return new PositionStateChangeEvent('opened', exchangePosition);
  }

  static createClosed(exchangePosition: ExchangePosition): PositionStateChangeEvent {
    return new PositionStateChangeEvent('closed', exchangePosition);
  }
}
