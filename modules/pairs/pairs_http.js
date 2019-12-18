const _ = require('lodash');

module.exports = class PairsHttp {
  constructor(instances, exchangeManager, pairStateManager, eventEmitter) {
    this.instances = instances;
    this.exchangeManager = exchangeManager;
    this.pairStateManager = pairStateManager;
    this.eventEmitter = eventEmitter;
  }

  async getTradePairs() {
    return new Promise(async resolve => {
      const pairs = [];

      for (const symbol of this.instances.symbols) {
        if (_.get(symbol, 'trade.capital', 0) <= 0 && _.get(symbol, 'trade.currency_capital', 0) <= 0) {
          continue;
        }

        const position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol);
        const state = await this.pairStateManager.get(symbol.exchange, symbol.symbol);

        const item = {
          exchange: symbol.exchange,
          symbol: symbol.symbol,
          watchdogs: symbol.watchdogs,
          state: symbol.state,
          has_position: position !== undefined,
          capital: `${_.get(symbol, 'trade.capital', 0)} / ${_.get(symbol, 'trade.currency_capital', 0)}`,
          strategies: symbol.trade.strategies || []
        };

        if (state && state.state) {
          item.process = state.state;
        }

        pairs.push(item);
      }

      resolve(pairs);
    });
  }

  async triggerOrder(exchangeName, symbol, action) {
    let side = action;
    const options = {};
    if (['long_market', 'short_market', 'close_market'].includes(action)) {
      options.market = true;
      side = side.replace('_market', '');
    }

    this.pairStateManager.update(exchangeName, symbol, side, options);

    this.eventEmitter.emit('tick_ordering');
  }
};
