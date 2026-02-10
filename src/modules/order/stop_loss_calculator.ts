import { Tickers } from '../../storage/tickers';
import { Position } from '../../dict/position';

export interface StopLossOptions {
  percent?: number;
}

export class StopLossCalculator {
  private tickers: Tickers;
  private logger: any;

  constructor(tickers: Tickers, logger: any) {
    this.tickers = tickers;
    this.logger = logger;
  }

  async calculateForOpenPosition(
    exchange: string,
    position: Position,
    options: StopLossOptions = { percent: 3 }
  ): Promise<number | undefined> {
    const { tickers } = this;

    return new Promise(resolve => {
      if (!position.entry) {
        this.logger.info(`Invalid position entry for stop loss:${JSON.stringify(position)}`);
        resolve(undefined);

        return;
      }

      let price: number | undefined;
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

        return resolve(undefined);
      }

      const ticker = tickers.get(exchange, position.symbol);

      if (!ticker) {
        this.logger.info(`Ticker not found for stop loss:${JSON.stringify(position)}`);

        resolve(undefined);
        return;
      }

      if (position.side === 'long') {
        if (price > ticker.ask) {
          this.logger.info(
            `Ticker out of range stop loss (long): ${JSON.stringify(position)}${JSON.stringify(ticker)}`
          );

          resolve(undefined);
          return;
        }
      } else if (position.side === 'short') {
        if (price < ticker.bid) {
          this.logger.info(
            `Ticker out of range stop loss (short): ${JSON.stringify(position)}${JSON.stringify(ticker)}`
          );

          resolve(undefined);
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
}
