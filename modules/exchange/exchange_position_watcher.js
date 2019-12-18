const _ = require('lodash');
const PositionStateChangeEvent = require('../../event/position_state_change_event');

module.exports = class ExchangePositionWatcher {
  constructor(exchangeManager, eventEmitter, logger) {
    this.exchangeManager = exchangeManager;
    this.eventEmitter = eventEmitter;
    this.logger = logger;

    this.positions = {};
    this.init = false;
  }

  async onPositionStateChangeTick() {
    const positions = await this.exchangeManager.getPositions();

    // first run after start
    if (!this.init) {
      positions.forEach(position => {
        this.positions[position.getKey()] = position;
      });

      this.init = true;
    }

    const currentOpen = [];

    for (const position of positions) {
      const key = position.getKey();
      currentOpen.push(key);

      if (!(key in this.positions)) {
        // new position
        this.logger.info(`Position opened:${JSON.stringify([position.getExchange(), position.getSymbol(), position])}`);
        this.positions[position.getKey()] = position;
        this.eventEmitter.emit(PositionStateChangeEvent.EVENT_NAME, PositionStateChangeEvent.createOpened(position));
      }
    }

    for (const [key, position] of Object.entries(this.positions)) {
      if (!currentOpen.includes(key)) {
        // closed position
        this.logger.info(`Position closed:${JSON.stringify([position.getExchange(), position.getSymbol(), position])}`);

        delete this.positions[key];
        this.eventEmitter.emit(PositionStateChangeEvent.EVENT_NAME, PositionStateChangeEvent.createClosed(position));
      }
    }
  }
};
