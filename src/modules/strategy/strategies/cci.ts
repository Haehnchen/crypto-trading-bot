import { SignalResult } from '../dict/signal_result';
import { IndicatorBuilder } from '../dict/indicator_builder';
import { IndicatorPeriod } from '../dict/indicator_period';

export class CCI {
  getName(): string {
    return 'cci';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, options: Record<string, any>): void {
    if (!options.period) {
      throw new Error('Invalid period');
    }

    indicatorBuilder.add('cci', 'cci', options.period);

    indicatorBuilder.add('sma200', 'sma', options.period, {
      length: 200
    });

    indicatorBuilder.add('ema200', 'ema', options.period, {
      length: 200
    });
  }

  async period(indicatorPeriod: IndicatorPeriod): Promise<SignalResult | undefined> {
    return await this.cci(
      indicatorPeriod.getPrice(),
      indicatorPeriod.getIndicator('sma200'),
      indicatorPeriod.getIndicator('ema200'),
      indicatorPeriod.getIndicator('cci'),
      indicatorPeriod.getLastSignal()
    );
  }

  async cci(
    price: number,
    sma200Full: number[] | undefined,
    ema200Full: number[] | undefined,
    cciFull: number[] | undefined,
    lastSignal: string | undefined
  ): Promise<SignalResult | undefined> {
    if (
      !cciFull ||
      !sma200Full ||
      !ema200Full ||
      cciFull.length <= 0 ||
      sma200Full.length < 2 ||
      ema200Full.length < 2
    ) {
      return undefined;
    }

    // remove incomplete candle
    const sma200 = sma200Full.slice(0, -1);
    const ema200 = ema200Full.slice(0, -1);
    const cci = cciFull.slice(0, -1);

    const debug: Record<string, any> = {
      sma200: sma200.slice(-1)[0],
      ema200: ema200.slice(-1)[0],
      cci: cci.slice(-1)[0]
    };

    const before = cci.slice(-2)[0];
    const last = cci.slice(-1)[0];

    // trend change
    if (
      (lastSignal === 'long' && before > 100 && last < 100) ||
      (lastSignal === 'short' && before < -100 && last > -100)
    ) {
      return SignalResult.createSignal('close', debug);
    }

    let long = price >= sma200.slice(-1)[0];

    // ema long
    if (!long) {
      long = price >= ema200.slice(-1)[0];
    }

    const count = cci.length - 1;

    if (long) {
      // long

      if (before <= -100 && last >= -100) {
        let rangeValues: number[] = [];

        for (let i = count - 1; i >= 0; i--) {
          if (cci[i] >= -100) {
            rangeValues = cci.slice(i, count);
            break;
          }
        }

        const min = Math.min(...rangeValues);
        if (min <= -200) {
          debug._trigger = min;
          return SignalResult.createSignal('long', debug);
        }
      }
    } else if (before >= 100 && last <= 100) {
      let rangeValues: number[] = [];

      for (let i = count - 1; i >= 0; i--) {
        if (cci[i] <= 100) {
          rangeValues = cci.slice(i, count);
          break;
        }
      }

      const max = Math.max(...rangeValues);
      if (max >= 200) {
        debug._trigger = max;
        return SignalResult.createSignal('short', debug);
      }
    }

    return SignalResult.createEmptySignal(debug);
  }

  getBacktestColumns(): any[] {
    return [
      {
        label: 'cci',
        value: 'cci',
        type: 'oscillator',
        range: [100, -100]
      }
    ];
  }

  getOptions(): Record<string, any> {
    return {
      period: '15m'
    };
  }
}

export default CCI;
