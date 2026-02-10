import { SignalResult } from '../dict/signal_result';
import { IndicatorBuilder } from '../dict/indicator_builder';
import { IndicatorPeriod } from '../dict/indicator_period';
import { TechnicalAnalysis } from '../../../utils/technical_analysis';

const TA = new TechnicalAnalysis();

export class CciMacd {
  getName(): string {
    return 'cci_macd';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, options: Record<string, any>): void {
    indicatorBuilder.add('cci', 'cci', options.period, {
      length: 40
    });

    indicatorBuilder.add('adx', 'adx', options.period);

    indicatorBuilder.add('macd', 'macd', options.period, {
      fast_length: 12 * 2,
      slow_length: 26 * 2,
      signal_length: 9 * 2
    });

    indicatorBuilder.add('sma', 'sma', '15m', {
      length: 400
    });
  }

  async period(indicatorPeriod: IndicatorPeriod, options: Record<string, any>): Promise<SignalResult> {
    const currentValues = indicatorPeriod.getLatestIndicators();

    const result = SignalResult.createEmptySignal(currentValues);

    // which direction is allowed here
    let allowedSignal: string = 'unknown';
    if (currentValues.sma) {
      allowedSignal = indicatorPeriod.getPrice() > currentValues.sma ? 'long' : 'short';
    }

    result.addDebug('direction', allowedSignal);

    // no signal
    const currentSignal = this.macdCciSignalTrigger(indicatorPeriod, result, options);
    if (!currentSignal) {
      return result;
    }

    // open position
    const lastSignal = indicatorPeriod.getLastSignal();
    if (!lastSignal) {
      // open position in allowed direction
      if (currentValues.sma && !this.isSideways(indicatorPeriod)) {
        const allowedSignal = indicatorPeriod.getPrice() > currentValues.sma ? 'long' : 'short';
        if (allowedSignal === currentSignal) {
          result.setSignal(currentSignal);
        }
      }
    } else if (
      (lastSignal === 'long' && currentSignal === 'short') || // close long
      (lastSignal === 'short' && currentSignal === 'long') // close short
    ) {
      result.setSignal('close');
      return result;
    }

    return result;
  }

  isSideways(indicatorPeriod: IndicatorPeriod): boolean {
    for (const value of indicatorPeriod.visitLatestIndicators(10)) {
      if (value.adx > 25) {
        return false;
      }
    }

    return true;
  }

  macdCciSignalTrigger(
    indicatorPeriod: IndicatorPeriod,
    result: SignalResult,
    options: Record<string, any>
  ): string | undefined {
    const macdLooback = indicatorPeriod.getIndicator('macd') as any[];

    const macdPivotReversal = options.macd_pivot_reversal || 5;
    const cciTrigger = options.cci_trigger || 150;

    const macdPivot = TA.getPivotPoints(
      macdLooback.slice(macdPivotReversal * -3).map((macd: any) => macd.histogram),
      macdPivotReversal,
      macdPivotReversal
    );
    if (!macdPivot) {
      return undefined;
    }

    result.addDebug('macd_pivot', macdPivot);

    if (macdPivot.high && macdPivot.high > 0) {
      for (const value of indicatorPeriod.visitLatestIndicators(options.cci_cross_lookback_for_macd_trigger)) {
        if (value.cci >= cciTrigger) {
          result.addDebug('hint', 'success');

          return 'short';
        }
      }
    }

    if (macdPivot.low && macdPivot.low < 0) {
      for (const value of indicatorPeriod.visitLatestIndicators(options.cci_cross_lookback_for_macd_trigger)) {
        if (value.cci <= -cciTrigger) {
          result.addDebug('hint', 'danger');
          return 'long';
        }
      }
    }

    return undefined;
  }

  getBacktestColumns(): any[] {
    return [
      {
        label: 'cci',
        value: 'cci',
        type: 'oscillator',
        range: [150, -150]
      },
      {
        label: 'macd',
        value: 'macd.histogram'
      },
      {
        label: 'macd_pivot',
        value: 'macd_pivot'
      },
      {
        label: 'hint',
        value: 'hint',
        type: 'icon'
      },
      {
        label: 'direction',
        value: 'direction'
      },
      {
        label: 'adx',
        value: 'adx'
      }
    ];
  }

  getOptions(): Record<string, any> {
    return {
      period: '15m',
      macd_pivot_reversal: 5,
      cci_trigger: 150,
      cci_cross_lookback_for_macd_trigger: 12
    };
  }
}
