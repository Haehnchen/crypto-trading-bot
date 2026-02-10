import { SignalResult } from '../../dict/signal_result';
import { IndicatorBuilder } from '../../dict/indicator_builder';
import { IndicatorPeriod } from '../../dict/indicator_period';

export interface DipCatcherOptions {
  period: string;
  trend_cloud_multiplier?: number;
  hma_high_period?: number;
  hma_high_candle_source?: string;
  hma_low_period?: number;
  hma_low_candle_source?: string;
}

export class DipCatcher {
  getName(): string {
    return 'dip_catcher';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, options: DipCatcherOptions): void {
    // line for short entry or long exit
    indicatorBuilder.add('hma_high', 'hma', options.period, {
      length: options.hma_high_period || 12,
      source: options.hma_high_candle_source || 'high'
    });

    // line for long entry or short exit
    indicatorBuilder.add('hma_low', 'hma', options.period, {
      length: options.hma_low_period || 12,
      source: options.hma_low_candle_source || 'low'
    });

    // basic price normalizer
    indicatorBuilder.add('hma', 'hma', options.period, {
      length: 9
    });

    // our main direction
    const trendCloudMultiplier = options.trend_cloud_multiplier || 4;
    indicatorBuilder.add('cloud', 'ichimoku_cloud', options.period, {
      conversionPeriod: 9 * trendCloudMultiplier,
      basePeriod: 26 * trendCloudMultiplier,
      spanPeriod: 52 * trendCloudMultiplier,
      displacement: 26 * trendCloudMultiplier
    });

    indicatorBuilder.add('bb', 'bb', '15m');
  }

  period(indicatorPeriod: IndicatorPeriod): SignalResult {
    const currentValues = indicatorPeriod.getLatestIndicators();

    const hma = (indicatorPeriod.getIndicator('hma') as number[]).slice(-2);
    const hmaLow = (indicatorPeriod.getIndicator('hma_low') as number[]).slice(-2);
    const hmaHigh = (indicatorPeriod.getIndicator('hma_high') as number[]).slice(-2);
    const bb = (indicatorPeriod.getIndicator('bb') as any[]).slice(-2);
    const cloud = (indicatorPeriod.getIndicator('cloud') as any[]).slice(-1);

    const emptySignal = SignalResult.createEmptySignal(currentValues);

    if (!cloud[0] || !hma[0]) {
      return emptySignal;
    }

    const lastSignal = indicatorPeriod.getLastSignal();

    // follow the main trend with entries
    const isLong = hma[0] > cloud[0].spanB;
    emptySignal.addDebug('trend', isLong);

    if (hmaLow[0] > bb[0].lower && hmaLow[1] < bb[1].lower) {
      if (!lastSignal && isLong) {
        emptySignal.addDebug('message', 'long_lower_cross');

        emptySignal.setSignal('long');
      } else if (lastSignal) {
        emptySignal.setSignal('close');
      }
    }

    if (hmaHigh[0] < bb[0].upper && hmaHigh[1] > bb[1].upper) {
      if (!lastSignal && !isLong) {
        emptySignal.addDebug('message', 'short_upper_cross');

        emptySignal.setSignal('short');
      } else if (lastSignal) {
        emptySignal.setSignal('close');
      }
    }

    return emptySignal;
  }

  getBacktestColumns(): any[] {
    return [
      {
        label: 'bb_hma',
        value: (row: any) => {
          if (!row.bb) {
            return undefined;
          }

          if (row.hma < row.bb.lower) {
            return 'success';
          }

          if (row.hma > row.bb.upper) {
            return 'danger';
          }

          return undefined;
        },
        type: 'icon'
      },
      {
        label: 'trend',
        value: (row: any) => {
          if (typeof row.trend !== 'boolean') {
            return undefined;
          }

          return row.trend === true ? 'success' : 'danger';
        },
        type: 'icon'
      },
      {
        label: 'message',
        value: 'message'
      }
    ];
  }

  getOptions(): DipCatcherOptions {
    return {
      period: '15m',
      trend_cloud_multiplier: 4,
      hma_high_period: 9,
      hma_high_candle_source: 'close',
      hma_low_period: 9,
      hma_low_candle_source: 'close'
    };
  }
}

export default DipCatcher;
