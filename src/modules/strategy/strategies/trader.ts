import { SignalResult } from '../dict/signal_result';
import { IndicatorBuilder } from '../dict/indicator_builder';
import { IndicatorPeriod } from '../dict/indicator_period';
import { getPivotPoints } from '../../../utils/technical_analysis';
import { Resample } from '../../../utils/resample';
import * as TechnicalPattern from '../../../utils/technical_pattern';

export class Trader {
  getName(): string {
    return 'trader';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, _options: Record<string, any>): void {
    indicatorBuilder.add('candles_1m', 'candles', '1m');
    indicatorBuilder.add('bb', 'bb', '15m', {
      length: 40
    });
  }

  async period(indicatorPeriod: IndicatorPeriod, _options: Record<string, any>): Promise<SignalResult> {
    const currentValues = indicatorPeriod.getLatestIndicators();

    const result = SignalResult.createEmptySignal(currentValues);

    const candles1m = indicatorPeriod.getIndicator('candles_1m') as any[] | undefined;
    if (!candles1m) {
      return result;
    }

    const candles3m = Resample.resampleMinutes(candles1m.slice().reverse(), 3);

    const foo = getPivotPoints(
      candles1m.slice(-10).map((c: any) => c.close),
      3,
      3
    );

    const bb = indicatorPeriod.getLatestIndicator('bb') as any;

    const lastCandle = candles1m.slice(-1)[0];
    result.addDebug('price2', lastCandle.close);

    if (bb && lastCandle && lastCandle.close > bb.upper) {
      result.addDebug('v', 'success');

      const bbIndicator = indicatorPeriod.getIndicator('bb') as any[];

      bbIndicator
        .slice(-10)
        .reverse()
        .map((b: any) => b.width);

      if ((currentValues.bb as any).width < 0.05) {
        result.addDebug('x', (currentValues.bb as any).width);
        result.setSignal('long');
      }
    }

    result.addDebug('pivot', foo);

    result.mergeDebug(TechnicalPattern.volumePump(candles3m.slice().reverse() || []));

    return result;
  }

  getBacktestColumns(): any[] {
    return [
      {
        label: 'price2',
        value: 'price2'
      },
      {
        label: 'RSI',
        value: 'rsi'
      },
      {
        label: 'roc',
        value: 'roc_1m'
      },
      {
        label: 'roc_ma',
        value: 'roc_ma',
        type: 'icon'
      },
      {
        label: 'Vol',
        value: 'candles_1m.volume'
      },
      {
        label: 'VolSd',
        value: 'volume_sd'
      },
      {
        label: 'VolV',
        value: 'volume_v'
      },
      {
        label: 'hint',
        value: 'hint',
        type: 'icon'
      },
      {
        label: 'v',
        value: 'v',
        type: 'icon'
      },
      {
        label: 'x',
        value: 'x'
      },
      {
        label: 'pivot',
        value: 'pivot'
      }
    ];
  }

  getOptions(): Record<string, any> {
    return {
      period: '15m'
    };
  }
}

export default Trader;
