import { SignalResult } from '../dict/signal_result';
import { IndicatorBuilder } from '../dict/indicator_builder';
import { IndicatorPeriod } from '../dict/indicator_period';
import { Candlestick } from '../../../dict/candlestick';

export class PivotReversalStrategy {
  getName(): string {
    return 'pivot_reversal_strategy';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, options: Record<string, any>): void {
    indicatorBuilder.add('candles_1m', 'candles', '1m');
    indicatorBuilder.add('pivot_points', 'pivot_points_high_low', '15m', {
      left: options.left || 4,
      right: options.right || 2
    });

    indicatorBuilder.add('sma200', 'sma', '1h', {
      length: 200
    });

    indicatorBuilder.add('sma50', 'sma', '1h', {
      length: 50
    });
  }

  async period(indicatorPeriod: IndicatorPeriod): Promise<SignalResult | undefined> {
    let debug: Record<string, any>;
    const currentValues = (debug = indicatorPeriod.getLatestIndicators());
    if (!currentValues.sma200 || (currentValues.sma200 as number[]).length < 10) {
      return undefined;
    }

    const candles1m = indicatorPeriod.getIndicator('candles_1m') as Candlestick[];
    if (candles1m) {
      debug.candles = candles1m
        .slice(-3)
        .map((c: Candlestick) => c.close)
        .join(', ');
    }

    // close; use watchdog!
    const lastSignal = indicatorPeriod.getLastSignal();
    if (lastSignal) {
      return SignalResult.createEmptySignal(debug);

      if (lastSignal === 'long' && !this.getPivotSignal(false, indicatorPeriod)) {
        return SignalResult.createSignal('close', debug);
      }

      if (lastSignal === 'short' && !this.getPivotSignal(true, indicatorPeriod)) {
        return SignalResult.createSignal('close', debug);
      }

      return SignalResult.createEmptySignal(debug);
    }

    const long = indicatorPeriod.getPrice() > (currentValues.sma200 as number[]).slice(-1)[0];

    const signal = this.getPivotSignal(long, indicatorPeriod);
    if (signal) {
      return SignalResult.createSignal(signal, debug);
    }

    return SignalResult.createEmptySignal(debug);
  }

  getPivotSignal(long: boolean, indicatorPeriod: IndicatorPeriod): string | undefined {
    for (const value of indicatorPeriod.visitLatestIndicators(3)) {
      if (!long && value.pivot_points && (value.pivot_points as any).low && (value.pivot_points as any).low.low) {
        const candles1m = indicatorPeriod.getIndicator('candles_1m') as Candlestick[];
        const mins = candles1m.slice(-7);

        const closes =
          mins
            .map((c: Candlestick) => c.close)
            .reduce((acc: number, val: number) => {
              return acc + val;
            }, 0) / mins.length;

        if (closes < (value.pivot_points as any).low.low) {
          return 'short';
        }

        break;
      }

      if (long && value.pivot_points && (value.pivot_points as any).high && (value.pivot_points as any).high.high) {
        const candles1m = indicatorPeriod.getIndicator('candles_1m') as Candlestick[];
        const mins = candles1m.slice(-7);

        const closes =
          mins
            .map((c: Candlestick) => c.close)
            .reduce((acc: number, val: number) => {
              return acc + val;
            }, 0) / mins.length;

        if (closes > (value.pivot_points as any).high.high) {
          return 'long';
        }

        break;
      }
    }

    return undefined;
  }

  getBacktestColumns(): any[] {
    return [
      {
        label: 'SMA 50/200',
        value: 'sma50',
        type: 'cross',
        cross: 'sma200'
      },
      {
        label: 'sma200',
        value: 'sma200'
      },
      {
        label: 'sma50',
        value: 'sma50'
      },
      {
        label: 'Pivot Points',
        value: 'pivot_points'
      },
      {
        label: 'candles_1m',
        value: 'candles_1m.close'
      },
      {
        label: 'candles',
        value: 'candles'
      },
      {
        label: 'debug',
        value: 'debug'
      }
    ];
  }

  getOptions(): Record<string, any> {
    return {
      period: '15m',
      left: 4,
      right: 2
    };
  }
}
