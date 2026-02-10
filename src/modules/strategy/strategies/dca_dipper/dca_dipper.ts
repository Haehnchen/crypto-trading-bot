import { SignalResult } from '../../dict/signal_result';
import { IndicatorBuilder } from '../../dict/indicator_builder';
import { IndicatorPeriod } from '../../dict/indicator_period';

export interface DcaDipperOptions {
  period: string;
  amount_currency: string;
  percent_below_price?: number;
  hma_period?: number;
  hma_source?: string;
  bb_length?: number;
  bb_stddev?: number;
}

export class DcaDipper {
  getName(): string {
    return 'dca_dipper';
  }

  buildIndicator(indicatorBuilder: IndicatorBuilder, options: DcaDipperOptions): void {
    // basic price normalizer
    indicatorBuilder.add('hma', 'hma', options.period, {
      length: options.hma_period || 9,
      source: options.hma_source || 'close'
    });

    indicatorBuilder.add('bb', 'bb', options.period, {
      length: options.bb_length || 20,
      stddev: options.bb_stddev || 2
    });
  }

  period(indicatorPeriod: IndicatorPeriod): SignalResult | undefined {
    const currentValues = indicatorPeriod.getLatestIndicators();

    const price = indicatorPeriod.getPrice();
    if (!price) {
      throw new Error('No price given');
    }

    const context = indicatorPeriod.getStrategyContext() as any;
    const options = context.getOptions() as DcaDipperOptions;

    if (!options.amount_currency) {
      throw new Error('No amount_currency given');
    }

    const hma = (indicatorPeriod.getIndicator('hma') as number[]).slice(-2);
    const bb = (indicatorPeriod.getIndicator('bb') as any[]).slice(-2);

    if (bb.length < 2 || hma.length < 2) {
      return undefined;
    }

    let shouldBuy = false;
    if (hma[0] > bb[0].lower && hma[1] < bb[1].lower) {
      shouldBuy = true;
    }

    const emptySignal = SignalResult.createEmptySignal(currentValues);
    emptySignal.addDebug('buy', shouldBuy);

    if (shouldBuy) {
      // percent below current price
      const orderPrice =
        options.percent_below_price && options.percent_below_price > 0
          ? price * (1 - options.percent_below_price / 100)
          : price;

      emptySignal.addDebug('price', orderPrice);

      // give feedback on backtest via chart
      if (context.isBacktest()) {
        emptySignal.setSignal('long');
      }

      emptySignal.placeBuyOrder(parseFloat(options.amount_currency), orderPrice);
    }

    return emptySignal;
  }

  getBacktestColumns(): any[] {
    return [
      {
        label: 'buy',
        value: (row: any) => {
          if (row.buy) {
            return 'success';
          }
          return undefined;
        },
        type: 'icon'
      },
      {
        label: 'price',
        value: 'price'
      }
    ];
  }

  getOptions(): DcaDipperOptions {
    return {
      period: '15m',
      amount_currency: '12',
      percent_below_price: 0.1,
      hma_period: 9,
      hma_source: 'close',
      bb_length: 20,
      bb_stddev: 2
    };
  }
}

export default DcaDipper;
