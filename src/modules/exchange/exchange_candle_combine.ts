import { Candlestick } from '../../dict/candlestick';
import { CandlestickRepository } from '../../repository';

export interface ExchangeSymbolPair {
  name: string;
  symbol: string;
}

export class ExchangeCandleCombine {
  constructor(private candlestickRepository: CandlestickRepository) {}

  async fetchCombinedCandles(
    mainExchange: string,
    symbol: string,
    period: string,
    exchanges: ExchangeSymbolPair[] = [],
    olderThen?: number
  ): Promise<Record<string, Candlestick[]>> {
    return this.combinedCandles(
      this.candlestickRepository.getLookbacksForPair(mainExchange, symbol, period, 750, olderThen),
      mainExchange,
      symbol,
      period,
      exchanges
    );
  }

  async fetchCombinedCandlesSince(
    mainExchange: string,
    symbol: string,
    period: string,
    exchanges: ExchangeSymbolPair[] = [],
    start: number
  ): Promise<Record<string, Candlestick[]>> {
    return this.combinedCandles(
      this.candlestickRepository.getLookbacksSince(mainExchange, symbol, period, start),
      mainExchange,
      symbol,
      period,
      exchanges
    );
  }

  async fetchCandlePeriods(mainExchange: string, symbol: string): Promise<string[]> {
    return this.candlestickRepository.getCandlePeriods(mainExchange, symbol);
  }

  async combinedCandles(
    candlesAwait: Promise<Candlestick[]>,
    mainExchange: string,
    symbol: string,
    period: string,
    exchanges: ExchangeSymbolPair[] = []
  ): Promise<Record<string, Candlestick[]>> {
    const currentTime = Math.round(new Date().getTime() / 1000);

    // we filter the current candle, be to able to use it later
    const candles = (await candlesAwait).filter((c: Candlestick) => c.time <= currentTime);

    const result: Record<string, Candlestick[]> = {
      [mainExchange]: candles
    };

    // no need for overhead
    if (exchanges.length === 0 || candles.length === 0) {
      return result;
    }

    const c: Record<string, Record<number, Candlestick>> = {
      [mainExchange]: {}
    };

    candles.forEach((candle: Candlestick) => {
      c[mainExchange][candle.time] = candle;
    });

    const start = candles[candles.length - 1].time;

    await Promise.all(
      exchanges.map(exchange => {
        return new Promise(async resolve => {
          const candles: Record<number, Candlestick> = {};

          const databaseCandles = await this.candlestickRepository.getLookbacksSince(
            exchange.name,
            exchange.symbol,
            period,
            start
          );
          databaseCandles.forEach((candle: Candlestick) => {
            candles[candle.time] = candle;
          });

          const myCandles: Candlestick[] = [];

          let timeMatchedOnce = false;
          for (const time of Object.keys(c[mainExchange])) {
            const timeNum = parseInt(time);
            // time was matched
            if (candles[timeNum]) {
              myCandles.push(candles[timeNum]);
              timeMatchedOnce = true;
              continue;
            }

            // pipe the close prices from last known candle
            const previousCandle = myCandles[myCandles.length - 1];

            const candle = previousCandle
              ? new Candlestick(
                  timeNum,
                  previousCandle.close,
                  previousCandle.close,
                  previousCandle.close,
                  previousCandle.close,
                  0
                )
              : new Candlestick(timeNum, 0, 0, 0, 0, 0);

            myCandles.push(candle);
          }

          if (timeMatchedOnce) {
            result[exchange.name + exchange.symbol] = myCandles.reverse();
          }

          resolve(undefined);
        });
      })
    );

    return result;
  }
}
