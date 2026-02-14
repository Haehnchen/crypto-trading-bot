/**
 * DCA Dipper Strategy - Dollar Cost Averaging during dips
 *
 * Strategy: Buy when HMA crosses above Bollinger Band lower band from below
 * Used for Dollar Cost Averaging during dips
 */

import strategy, { StrategyBase, TypedStrategyContext, StrategySignal, type TypedIndicatorDefinition } from '../../strategy';

// ============== Strategy Options ==============

export interface DcaDipperOptions {
  amount_currency: string;
  percent_below_price?: number;
  hma_period?: number;
  hma_source?: string;
  bb_length?: number;
  bb_stddev?: number;
}

// ============== Indicator Definition ==============

export type DcaDipperIndicators = {
  hma: TypedIndicatorDefinition<'hma'>;
  bb: TypedIndicatorDefinition<'bb'>;
};

// ============== Strategy Implementation ==============

export class DcaDipper extends StrategyBase<DcaDipperIndicators, DcaDipperOptions> {
  getDescription(): string {
    return 'Dollar Cost Averaging strategy - Buy when HMA crosses above Bollinger Band lower band';
  }

  defineIndicators(): DcaDipperIndicators {
    return {
      hma: strategy.indicator.hma({
        length: this.options.hma_period,
        source: this.options.hma_source
      }),
      bb: strategy.indicator.bb({
        length: this.options.bb_length,
        stddev: this.options.bb_stddev
      })
    };
  }

  async execute(context: TypedStrategyContext<DcaDipperIndicators>, signal: StrategySignal): Promise<void> {
    const price = context.price;

    const hmaRaw = context.getIndicatorSlice('hma', 3);
    const bbRaw = context.getIndicatorSlice('bb', 3);

    const hmaValues = (Array.isArray(hmaRaw) ? hmaRaw.filter(v => v !== null) : []) as number[];
    const bbValues = (Array.isArray(bbRaw) ? bbRaw.filter(v => v !== null) : []) as any[];

    if (hmaValues.length < 2 || bbValues.length < 2) {
      return;
    }

    const currentHma = hmaValues[hmaValues.length - 1];
    const previousHma = hmaValues[hmaValues.length - 2];
    const currentBb = bbValues[bbValues.length - 1];
    const previousBb = bbValues[bbValues.length - 2];

    const shouldBuy = previousHma > previousBb.lower && currentHma < currentBb.lower;

    signal.debugAll({
      price,
      hma: Math.round(currentHma * 100) / 100,
      hma_prev: Math.round(previousHma * 100) / 100,
      bb_lower: Math.round(currentBb.lower * 100) / 100,
      bb_lower_prev: Math.round(previousBb.lower * 100) / 100,
      bb_middle: Math.round(currentBb.middle * 100) / 100,
      bb_upper: Math.round(currentBb.upper * 100) / 100,
      buy: shouldBuy
    });

    if (shouldBuy) {
      const orderPrice =
        this.options.percent_below_price && this.options.percent_below_price > 0 ? price * (1 - this.options.percent_below_price / 100) : price;

      signal.goLong();
      signal.placeBuyOrder(parseFloat(this.options.amount_currency), orderPrice);
    }
  }

  protected getDefaultOptions(): DcaDipperOptions {
    return {
      amount_currency: '12',
      percent_below_price: 0.1,
      hma_period: 9,
      hma_source: 'close',
      bb_length: 20,
      bb_stddev: 2
    };
  }
}
