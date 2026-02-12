import { SD } from 'technicalindicators';
import { getBollingerBandPercent } from '../../../utils/technical_analysis';
import { SignalResult } from '../dict/signal_result';
import { IndicatorBuilder } from '../dict/indicator_builder';
import { IndicatorPeriod } from '../dict/indicator_period';

export class Noop {
  getName(): string {
    return 'noop';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, _options: Record<string, any>): void {
    indicatorBuilder.add('bb', 'bb', '15m');
    indicatorBuilder.add('rsi', 'rsi', '15m');
    indicatorBuilder.add('mfi', 'mfi', '15m');
    indicatorBuilder.add('volume_profile', 'volume_profile', '15m');
    indicatorBuilder.add('zigzag', 'zigzag', '15m');

    indicatorBuilder.add('pivot_points_high_low', 'pivot_points_high_low', '15m', {
      left: 14,
      right: 14
    });

    indicatorBuilder.add('sma200', 'sma', '15m', {
      length: 200
    });

    indicatorBuilder.add('sma50', 'sma', '15m', {
      length: 50
    });

    indicatorBuilder.add('candles', 'candles');
  }

  async period(indicatorPeriod: IndicatorPeriod, options: Record<string, any>): Promise<SignalResult> {
    const currentValues = indicatorPeriod.getLatestIndicators();

    const bollinger = indicatorPeriod.getIndicator('bb');

    if (bollinger && currentValues.bb) {
      const standardDeviation = SD.calculate({
        period: 150,
        values: bollinger.slice(-200).map((b: any) => b.width)
      });

      (currentValues.bb as any).sd = standardDeviation.slice(-1)[0];
    }

    const currentBB = indicatorPeriod.getLatestIndicator('bb');
    if (currentBB && currentValues.bb) {
      (currentValues.bb as any).percent = getBollingerBandPercent(
        indicatorPeriod.getPrice(),
        currentBB.upper,
        currentBB.lower
      );
    }

    const intl = new Intl.NumberFormat('en-US', { minimumSignificantDigits: 3, maximumSignificantDigits: 4 });

    (currentValues as any).ranges = (indicatorPeriod.getIndicator('volume_profile') as any[] || [])
      .sort((a: any, b: any) => b.totalVolume - a.totalVolume)
      .slice(0, 3)
      .map((v: any) => `${intl.format(v.rangeStart)}-${intl.format(v.rangeEnd)}`)
      .join(', ');

    const emptySignal = SignalResult.createEmptySignal(currentValues);

    // entry or exit
    if (!indicatorPeriod.getLastSignal()) {
      const dice = parseFloat(options.dice || 6);
      const diceSize = parseFloat(options.dice_size || 12);

      const number = Math.floor(Math.random() * diceSize) + 1;
      emptySignal.addDebug('message', `${number}`);
      if (number === dice) {
        const longOrShort = Math.random() > 0.5 ? 'long' : 'short';
        emptySignal.setSignal(longOrShort);
      }
    }

    // close on profit or lose
    if (indicatorPeriod.getLastSignal()) {
      if (indicatorPeriod.getProfit() > 2) {
        // take profit
        emptySignal.addDebug('message', 'TP');
        emptySignal.setSignal('close');
      } else if (indicatorPeriod.getProfit() < -2) {
        // stop loss
        emptySignal.addDebug('message', 'SL');
        emptySignal.setSignal('close');
      }
    }

    return emptySignal;
  }

  getBacktestColumns(): any[] {
    return [
      {
        label: 'BollDev',
        value: 'bb.width',
        type: 'cross',
        cross: 'bb.sd'
      },
      {
        label: 'BollPct',
        value: 'bb.percent',
        type: 'oscillator',
        range: [1, 0]
      },
      {
        label: 'rsi',
        value: 'rsi',
        type: 'oscillator'
      },
      {
        label: 'mfi',
        value: 'mfi',
        type: 'oscillator'
      },
      {
        label: 'SMA 50/200',
        value: 'sma50',
        type: 'cross',
        cross: 'sma200'
      },
      {
        label: 'Pivot Points',
        value: 'pivot_points_high_low'
      },
      {
        label: 'Candles',
        value: 'candles.close'
      },
      {
        label: 'Top Volume Ranges',
        value: 'ranges'
      },
      {
        label: 'dice',
        value: 'message'
      },
      {
        label: 'zigzag',
        value: (row: any) => (row.zigzag && row.zigzag.turningPoint === true ? 'warning' : undefined),
        type: 'icon'
      }
    ];
  }

  getOptions(): Record<string, any> {
    return {
      period: '15m',
      dice: 6,
      dice_size: 12
    };
  }

  getTickPeriod(): string {
    return '1m';
  }
}

export default Noop;
