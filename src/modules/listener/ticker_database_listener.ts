import _ from 'lodash';
import { TickerRepository } from '../repository/ticker_repository';
import { TickerEvent } from '../../event/ticker_event';

export class TickerDatabaseListener {
  private trottle: Record<string, any>;

  constructor(tickerRepository: TickerRepository) {
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

  onTicker(tickerEvent: TickerEvent): void {
    const { ticker } = tickerEvent;
    this.trottle[ticker.symbol + ticker.exchange] = ticker;
  }
}
