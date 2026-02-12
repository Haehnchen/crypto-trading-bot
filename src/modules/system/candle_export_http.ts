import { CandlestickRepository } from '../../repository';
import { PairConfig } from '../pairs/pair_config';

export interface ExchangeSymbolPair {
  exchange: string;
  symbol: string;
}

export class CandleExportHttp {
  constructor(private candlestickRepository: CandlestickRepository, private pairConfig: PairConfig) {}

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
