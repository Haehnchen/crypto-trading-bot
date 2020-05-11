const _ = require('lodash');

module.exports = class TickerDatabaseListener {
  constructor(tickerRepository) {
    this.tickerRepository = tickerRepository;
  }

  onTicker(tickerEvent) {
    const { ticker } = tickerEvent;
    this.tickerRepository.insertTickers([ticker]);
  }
};
