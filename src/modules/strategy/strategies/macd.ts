import { SignalResult } from '../dict/signal_result';
import { IndicatorBuilder } from '../dict/indicator_builder';
import { IndicatorPeriod } from '../dict/indicator_period';

export interface MacdOptions {
  period: string;
  default_ma_type?: string;
  fast_period?: number;
  slow_period?: number;
  signal_period?: number;
}

export interface MacdHistogram {
  histogram: number;
}

export class Macd {
  getName(): string {
    return 'macd';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, options: MacdOptions): void {
    if (!options.period) {
      throw new Error('Invalid period');
    }

    indicatorBuilder.add('macd', 'macd_ext', options.period, options);

    indicatorBuilder.add('hma', 'hma', options.period, {
      length: 9
    });

    indicatorBuilder.add('sma200', 'sma', options.period, {
      length: 200
    });
  }

  period(indicatorPeriod: IndicatorPeriod): SignalResult | undefined {
    const sma200Full = indicatorPeriod.getIndicator('sma200') as number[] | undefined;
    const macdFull = indicatorPeriod.getIndicator('macd') as MacdHistogram[] | undefined;
    const hmaFull = indicatorPeriod.getIndicator('hma') as number[] | undefined;

    if (!macdFull || !sma200Full || !hmaFull || macdFull.length < 2 || sma200Full.length < 2) {
      return undefined;
    }

    const hma = hmaFull.slice(-1)[0];
    const sma200 = sma200Full.slice(-1)[0];
    const macd = macdFull.slice(-2);

    // overall trend filter
    const long = hma >= sma200;

    const lastSignal = indicatorPeriod.getLastSignal();

    const debug: Record<string, any> = {
      sma200: sma200,
      histogram: macd[0].histogram,
      last_signal: lastSignal,
      long: long
    };

    const current = macd[0].histogram;
    const before = macd[1].histogram;

    // trend change
    if ((lastSignal === 'long' && before > 0 && current < 0) || (lastSignal === 'short' && before < 0 && current > 0)) {
      return SignalResult.createSignal('close', debug);
    }

    if (long) {
      // long
      if (before < 0 && current > 0) {
        return SignalResult.createSignal('long', debug);
      }
    } else {
      // short

      if (before > 0 && current < 0) {
        return SignalResult.createSignal('short', debug);
      }
    }

    return SignalResult.createEmptySignal(debug);
  }

  getBacktestColumns(): any[] {
    return [
      {
        label: 'trend',
        value: (row: any) => {
          if (typeof row.long !== 'boolean') {
            return undefined;
          }

          return row.long === true ? 'success' : 'danger';
        },
        type: 'icon'
      },
      {
        label: 'histogram',
        value: 'histogram',
        type: 'histogram'
      }
    ];
  }

  getOptions(): MacdOptions {
    return {
      period: '15m',
      default_ma_type: 'EMA',
      fast_period: 12,
      slow_period: 26,
      signal_period: 9
    };
  }
}
