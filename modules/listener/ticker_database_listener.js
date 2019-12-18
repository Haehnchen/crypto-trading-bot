const _ = require('lodash');

module.exports = class TickerDatabaseListener {
  constructor(tickerRepository) {
    this.trottle = {};

    setInterval(async () => {
      const tickers = Object.values(this.trottle);
      this.trottle = {};

      if (tickers.length > 0) {
        for (const chunk of _.chunk(tickers, 100)) {
          await tickerRepository.insertTickers(chunk);
        }
      }
    }, 1000 * 15);
  }

  onTicker(tickerEvent) {
    const { ticker } = tickerEvent;
    this.trottle[ticker.symbol + ticker.exchange] = ticker;
  }
};
