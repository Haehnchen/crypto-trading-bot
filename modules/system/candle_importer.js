const _ = require('lodash');

module.exports = class CandleImporter {
  constructor(candlestickRepository) {
    this.candlestickRepository = candlestickRepository;
    this.trottle = {};
    this.promises = [];

    setInterval(async () => {
      const candles = Object.values(this.trottle);
      this.trottle = {};

      const promises = this.promises.slice();
      this.promises = [];

      // on init we can have a lot or REST api we can have a lot of candles
      // reduce database locking time by split them
      if (candles.length > 0) {
        for (const chunk of _.chunk(candles, 1000)) {
          await this.insertCandles(chunk);
        }
      }

      promises.forEach(resolve => {
        resolve();
      });
    }, 1000 * 5);
  }

  async insertCandles(candles) {
    return this.candlestickRepository.insertCandles(candles);
  }

  /**
   * We have spikes in each exchange on possible every full minute, collect them for a time range the candles and fire them at once
   *
   * @param candles
   * @returns {Promise<void>}
   */
  async insertThrottledCandles(candles) {
    for (const candle of candles) {
      this.trottle[candle.exchange + candle.symbol + candle.period + candle.time] = candle;
    }

    const { promise, resolve } = this.getPromise();

    this.promises.push(resolve);

    return promise;
  }

  /**
   * @private
   */
  getPromise() {
    let resolve;

    const promise = new Promise(res => {
      resolve = res;
    });

    return { promise, resolve };
  }
};
