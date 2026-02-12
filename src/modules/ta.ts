import moment from 'moment';
import {
  getPredefinedIndicators,
  getTrendingDirectionLastItem,
  getCrossedSince,
  getBollingerBandPercent,
  getTrendingDirection
} from '../utils/technical_analysis';
import { Ticker } from '../dict/ticker';
import { Candlestick } from '../dict/candlestick';
import { CandlestickRepository } from '../repository';
import { Tickers } from '../storage/tickers';

export interface TaSymbol {
  exchange: string;
  symbol: string;
  trade?: any;
  strategies?: any[];
}

export class Ta {
  private instances: { symbols: TaSymbol[] };
  private candlestickRepository: CandlestickRepository;
  private tickers: Tickers;

  constructor(candlestickRepository: CandlestickRepository, instances: { symbols: TaSymbol[] }, tickers: Tickers) {
    this.instances = instances;
    this.candlestickRepository = candlestickRepository;
    this.tickers = tickers;
  }

  async getTaForPeriods(periods: string[]): Promise<any> {
    const promises: Promise<any>[] = [];

    // filter same pair on different exchanges; last wins
    const uniqueSymbols: Record<string, TaSymbol> = {};
    this.instances.symbols.forEach((symbol: TaSymbol) => {
      uniqueSymbols[symbol.symbol] = symbol;
    });

    Object.values(uniqueSymbols).forEach((symbol: TaSymbol) => {
      periods.forEach((period: string) => {
        promises.push(
          (async () => {
            const candles = await this.candlestickRepository.getLookbacksForPair(
              symbol.exchange,
              symbol.symbol,
              period,
              200
            );

            if (candles.length === 0) {
              return undefined;
            }

            const rangeMin = moment()
              .subtract(24, 'hours')
              .subtract(35, 'minutes')
              .unix();
            const rangeMax = moment()
              .subtract(24, 'hours')
              .add(35, 'minutes')
              .unix();

            const dayCandle = candles.find((candle: Candlestick) => candle.time > rangeMin && candle.time < rangeMax);

            let change: number | undefined;
            if (dayCandle) {
              change = 100 * (candles[0].close / dayCandle.close) - 100;
            }

            const result = await getPredefinedIndicators(candles.slice().reverse());
            return {
              symbol: symbol.symbol,
              exchange: symbol.exchange,
              period: period,
              ta: result,
              ticker: new Ticker(symbol.exchange, symbol.symbol, undefined, candles[0].close, candles[0].close),
              percentage_change: change
            };
          })()
        );
      });
    });

    const values = await Promise.all(promises);
    const v = values.filter((value: any) => {
      return value !== undefined;
    });

    const x: Record<string, any> = {};

    v.forEach((v: any) => {
      if (!x[v.symbol]) {
        const liveTicker = this.tickers.get(v.exchange, v.symbol);
        x[v.symbol] = {
          symbol: v.symbol,
          exchange: v.exchange,
          ticker: liveTicker || v.ticker,
          ta: {},
          percentage_change: v.percentage_change
        };
      }

      // flat indicator list
      const values: Record<string, any> = {};

      for (const key in v.ta) {
        const taResult = v.ta[key];

        values[key] = {
          value: taResult[taResult.length - 1]
        };

        if (key == 'macd') {
          const r = taResult.slice();

          values[key].trend = getTrendingDirectionLastItem(r.slice(-2).map((v: any) => v.histogram));

          const number = getCrossedSince(r.map((v: any) => v.histogram));

          if (number) {
            let multiplicator = 1;
            if (v.period == '1h') {
              multiplicator = 60;
            } else if (v.period == '15m') {
              multiplicator = 15;
            }

            values[key].crossed = number * multiplicator;
            values[key].crossed_index = number;
          }
        } else if (key == 'ao') {
          const r = taResult.slice();

          values[key].trend = getTrendingDirectionLastItem(r.slice(-2));

          const number = getCrossedSince(r);

          if (number) {
            let multiplicator = 1;
            if (v.period == '1h') {
              multiplicator = 60;
            } else if (v.period == '15m') {
              multiplicator = 15;
            }

            values[key].crossed = number * multiplicator;
            values[key].crossed_index = number;
          }
        } else if (key == 'bollinger_bands') {
          values[key].percent =
            values[key].value && values[key].value.upper && values[key].value.lower
              ? getBollingerBandPercent(
                  (v.ticker.ask + v.ticker.bid) / 2,
                  values[key].value.upper,
                  values[key].value.lower
                ) * 100
              : null;
        } else if (
          key == 'ema_200' ||
          key == 'ema_55' ||
          key == 'cci' ||
          key == 'rsi' ||
          key == 'ao' ||
          key == 'mfi'
        ) {
          values[key].trend = getTrendingDirection(
            taResult
              .slice()
              .reverse()
              .slice(-5)
          );
        }
      }

      x[v.symbol].ta[v.period] = values;
    });

    return {
      rows: x,
      periods: periods
    };
  }
}
