import { convertPeriodToMinute, resampleMinutes } from '../../utils/resample';
import { ExchangeCandlestick } from '../../dict/exchange_candlestick';
import { CandlestickRepository } from '../../repository';
import { CandleImporter } from './candle_importer';

export class CandlestickResample {
  constructor(private candlestickRepository: CandlestickRepository, private candleImporter: CandleImporter) {}

  /**
   * Resample a eg "15m" range to a "1h"
   *
   * @param exchange The change name to resample
   * @param symbol Pair for resample
   * @param periodFrom From "5m" must be lower then "periodTo"
   * @param periodTo To new candles eg "1h"
   * @param limitCandles For mass resample history provide a switch else calculate the candle window on resample periods
   * @returns {Promise<void>}
   */
  async resample(
    exchange: string,
    symbol: string,
    periodFrom: string,
    periodTo: string,
    limitCandles: boolean = false
  ): Promise<void> {
    const toMinute = convertPeriodToMinute(periodTo);
    const fromMinute = convertPeriodToMinute(periodFrom);

    if (fromMinute > toMinute) {
      throw new Error('Invalid resample "from" must be geater then "to"');
    }

    // we need some
    let wantCandlesticks = 750;

    // we can limit the candles in the range we should resample
    // but for mass resample history provide a switch
    if (limitCandles === true) {
      wantCandlesticks = Math.round((toMinute / fromMinute) * 5.6);
    }

    const candlesticks = await this.candlestickRepository.getLookbacksForPair(
      exchange,
      symbol,
      periodFrom,
      wantCandlesticks
    );
    if (candlesticks.length === 0) {
      return;
    }

    const resampleCandlesticks = resampleMinutes(candlesticks, toMinute);

    const candles = resampleCandlesticks.map(candle => {
      return new ExchangeCandlestick(
        exchange,
        symbol,
        periodTo,
        candle.time,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume
      );
    });

    await this.candleImporter.insertThrottledCandles(candles);
  }
}
