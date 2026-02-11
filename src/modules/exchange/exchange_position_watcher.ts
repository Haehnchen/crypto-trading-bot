import { ExchangePosition } from '../../dict/exchange_position';
import { Position } from '../../dict/position';
import { PositionStateChangeEvent } from '../../event/position_state_change_event';
import type { Logger } from '../services';
import type { ExchangeManager } from './exchange_manager';
import type { EventEmitter } from 'events';

export class ExchangePositionWatcher {
  private exchangeManager: ExchangeManager;
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private positions: Record<string, ExchangePosition>;
  private init: boolean;

  constructor(exchangeManager: ExchangeManager, eventEmitter: EventEmitter, logger: Logger) {
    this.exchangeManager = exchangeManager;
    this.eventEmitter = eventEmitter;
    this.logger = logger;

    this.positions = {};
    this.init = false;
  }

  async onPositionStateChangeTick(): Promise<void> {
    const exchangePositions: ExchangePosition[] = await this.exchangeManager.getPositions();

    // first run after start
    if (!this.init) {
      exchangePositions.forEach((exchangePosition: ExchangePosition) => {
        const position = exchangePosition.getPosition();
        this.positions[exchangePosition.getKey()] = exchangePosition;
      });

      this.init = true;
    }

    const currentOpen: string[] = [];

    for (const exchangePosition of exchangePositions) {
      const key = exchangePosition.getKey();
      currentOpen.push(key);

      if (!(key in this.positions)) {
        // new position
        const position = exchangePosition.getPosition();
        this.logger.info(`Position opened:${JSON.stringify([exchangePosition.getExchange(), exchangePosition.getSymbol(), position])}`);
        this.positions[key] = exchangePosition;
        this.eventEmitter.emit(PositionStateChangeEvent.EVENT_NAME, PositionStateChangeEvent.createOpened(exchangePosition));
      }
    }

    for (const [key, exchangePosition] of Object.entries(this.positions)) {
      if (!currentOpen.includes(key)) {
        // closed position
        const position = exchangePosition.getPosition();
        this.logger.info(`Position closed:${JSON.stringify([position.getSymbol(), position])}`);

        delete this.positions[key];
        this.eventEmitter.emit(PositionStateChangeEvent.EVENT_NAME, PositionStateChangeEvent.createClosed(exchangePosition));
      }
    }
  }
}
