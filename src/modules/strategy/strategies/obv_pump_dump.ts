import { SignalResult } from '../dict/signal_result';
import { IndicatorBuilder } from '../dict/indicator_builder';
import { IndicatorPeriod } from '../dict/indicator_period';

export class ObvPumpDump {
  getName(): string {
    return 'obv_pump_dump';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, options: Record<string, any>): void {
    indicatorBuilder.add('obv', 'obv', '1m');

    indicatorBuilder.add('ema', 'ema', '1m', {
      length: 200
    });
  }

  async period(indicatorPeriod: IndicatorPeriod, options: Record<string, any>): Promise<SignalResult | undefined> {
    const triggerMultiplier = options.trigger_multiplier || 2;
    const triggerTimeWindows = options.trigger_time_windows || 3;

    const obv = indicatorPeriod.getIndicator('obv') as number[] | undefined;

    if (!obv || obv.length <= 20) {
      return undefined;
    }

    const price = indicatorPeriod.getPrice();
    const ema = (indicatorPeriod.getIndicator('ema') as number[]).slice(-1)[0];

    const debug: Record<string, any> = {
      obv: obv.slice(-1)[0],
      ema: ema
    };

    if (price > ema) {
      // long
      debug.trend = 'up';

      const before = obv.slice(-20, triggerTimeWindows * -1);

      const highest = before.sort((a, b) => b - a).slice(0, triggerTimeWindows);
      const highestOverage = highest.reduce((a, b) => a + b, 0) / highest.length;

      const current = obv.slice(triggerTimeWindows * -1);

      const currentAverage = current.reduce((a, b) => a + b, 0) / current.length;

      debug.highest_overage = highestOverage;
      debug.current_average = currentAverage;

      if (currentAverage < highestOverage) {
        return SignalResult.createEmptySignal(debug);
      }

      const difference = Math.abs(currentAverage / highestOverage);

      debug.difference = difference;

      if (difference >= triggerMultiplier) {
        return SignalResult.createSignal('long', debug);
      }
    } else {
      // short
      debug.trend = 'down';
    }

    return SignalResult.createEmptySignal(debug);
  }

  getOptions(): Record<string, any> {
    return {
      period: '15m',
      trigger_multiplier: 2,
      trigger_time_windows: 3
    };
  }
}

export default ObvPumpDump;
