export interface StrategyContext {
  bid?: number;
  getLastSignal?(): 'long' | 'short' | undefined;
  getProfit?(): number;
}

export interface IndicatorValues {
  [key: string]: any;
}

export class IndicatorPeriod {
  private readonly strategyContext: StrategyContext;
  private readonly indicators: IndicatorValues;

  constructor(strategyContext: StrategyContext, indicators: IndicatorValues) {
    this.strategyContext = strategyContext;
    this.indicators = indicators;
  }

  getPrice(): number | undefined {
    return this.strategyContext.bid;
  }

  getLastSignal(): 'long' | 'short' | undefined {
    if (!this.strategyContext || !this.strategyContext.getLastSignal) {
      return undefined;
    }

    return this.strategyContext.getLastSignal();
  }

  getProfit(): number | undefined {
    return this.strategyContext.getProfit?.();
  }

  isShort(): boolean {
    return this.getLastSignal() === 'short';
  }

  isLong(): boolean {
    return this.getLastSignal() === 'long';
  }

  /**
   * Context return for the current strategy, usable to get the previous strategy signals and current positions.
   *
   * Usable in a strategy by calling indicatorPeriod.getStrategyContext() --> then you can use the result to grab the
   * current entry, last signal, etc..
   */
  getStrategyContext(): StrategyContext {
    return this.strategyContext;
  }

  getIndicator(key: string): any {
    for (const k in this.indicators) {
      if (k === key) {
        return this.indicators[k];
      }
    }

    return undefined;
  }

  /**
   * Generate to iterate over item, starting with latest one going to oldest.
   * You should "break" the iteration until you found what you needed
   *
   * @param limit
   * @returns {IterableIterator<object>}
   */
  *visitLatestIndicators(limit: number = 200): Generator<IndicatorValues, void> {
    for (let i = 1; i < limit; i++) {
      const result: IndicatorValues = {};

      for (const key in this.indicators) {
        const indicatorArray = Array.isArray(this.indicators[key]) ? this.indicators[key] : [];
        if (!indicatorArray[indicatorArray.length - i]) {
          continue;
        }

        result[key] = indicatorArray[indicatorArray.length - i];
      }

      yield result;
    }

    return undefined;
  }

  /**
   * Get all indicator values from current candle
   */
  getLatestIndicators(): IndicatorValues {
    const result: IndicatorValues = {};

    for (const key in this.indicators) {
      const indicatorArray = Array.isArray(this.indicators[key]) ? this.indicators[key] : [];
      result[key] = indicatorArray[indicatorArray.length - 1];
    }

    return result;
  }

  /**
   * Get all indicator values from current candle
   */
  getLatestIndicator(key: string): any {
    for (const k in this.indicators) {
      if (k === key) {
        const indicatorArray = Array.isArray(this.indicators[k]) ? this.indicators[k] : [];
        return indicatorArray[indicatorArray.length - 1];
      }
    }

    return undefined;
  }
}
