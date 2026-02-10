import { CandlestickRepository } from '../repository/candlestick_repository';
import { PairConfig } from '../pairs/pair_config';

export interface ExchangeSymbolPair {
  exchange: string;
  symbol: string;
}

export class CandleExportHttp {
  private candlestickRepository: CandlestickRepository;
  private pairConfig: PairConfig;

  constructor(candlestickRepository: CandlestickRepository, pairConfig: PairConfig) {
    this.candlestickRepository = candlestickRepository;
    this.pairConfig = pairConfig;
  }

  async getCandles(exchange: string, symbol: string, period: string, start: Date, end: Date): Promise<any[]> {
    return this.candlestickRepository.getCandlesInWindow(exchange, symbol, period, start, end);
  }

  async getPairs(): Promise<ExchangeSymbolPair[]> {
    return this.pairConfig.getAllPairNames().map(p => {
      const split = p.split('.');

      return {
        exchange: split[0],
        symbol: split[1]
      };
    });
  }
}
