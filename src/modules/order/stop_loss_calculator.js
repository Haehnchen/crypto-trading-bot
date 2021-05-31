module.exports = class StopLossCalculator {
  constructor(tickers, logger) {
    this.tickers = tickers;
    this.logger = logger;
  }

  async calculateForOpenPosition(exchange, position, options = { percent: 3 }) {
    const { tickers } = this;

    return new Promise(resolve => {
      if (!position.entry) {
        this.logger.info(`Invalid position entry for stop loss:${JSON.stringify(position)}`);
        resolve();

        return;
      }

      let price;
      if (position.side === 'long') {
        if (options.percent) {
          price = position.entry * (1 - options.percent / 100);
        }
      } else if (options.percent) {
        price = position.entry * (1 + options.percent / 100);
      }

      // invalid price no value
      if (!price) {
        this.logger.info(`Empty price for stop loss:${JSON.stringify(position)}`);

        return resolve();
      }

      const ticker = tickers.get(exchange, position.symbol);

      if (!ticker) {
        this.logger.info(`Ticker not found for stop loss:${JSON.stringify(position)}`);

        resolve();
        return;
      }

      if (position.side === 'long') {
        if (price > ticker.ask) {
          this.logger.info(
            `Ticker out of range stop loss (long): ${JSON.stringify(position)}${JSON.stringify(ticker)}`
          );

          resolve();
          return;
        }
      } else if (position.side === 'short') {
        if (price < ticker.bid) {
          this.logger.info(
            `Ticker out of range stop loss (short): ${JSON.stringify(position)}${JSON.stringify(ticker)}`
          );

          resolve();
          return;
        }
      }

      // inverse price for lose long position via sell
      if (position.side === 'long') {
        price *= -1;
      }

      resolve(price);
    });
  }
};
