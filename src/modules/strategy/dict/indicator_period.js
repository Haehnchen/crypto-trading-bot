module.exports = class IndicatorPeriod {
  constructor(strategyContext, indicators) {
    this.strategyContext = strategyContext;
    this.indicators = indicators;
  }

  getPrice() {
    return this.strategyContext.bid;
  }

  getLastSignal() {
    if (!this.strategyContext || !this.strategyContext.getLastSignal()) {
      return undefined;
    }

    return this.strategyContext.getLastSignal();
  }

  getProfit() {
    return this.strategyContext.getProfit();
  }

  isShort() {
    return this.getLastSignal() === 'short';
  }

  isLong() {
    return this.getLastSignal() === 'long';
  }

  /**
   * Context return for the current strategy, usable to get the previous strategy signals and current positions.
   *
   * Usable in a strategy by calling indicatorPeriod.getStrategyContext() --> then you can use the result to grab the
   * current entry, last signal, etc..
   */
  getStrategyContext() {
    return this.strategyContext;
  }

  getIndicator(key) {
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
  *visitLatestIndicators(limit = 200) {
    for (let i = 1; i < limit; i++) {
      const result = {};

      for (const key in this.indicators) {
        if (!this.indicators[key][this.indicators[key].length - i]) {
          continue;
        }

        result[key] = this.indicators[key][this.indicators[key].length - i];
      }

      yield result;
    }

    return undefined;
  }

  /**
   * Get all indicator values from current candle
   */
  getLatestIndicators() {
    const result = {};

    for (const key in this.indicators) {
      result[key] = this.indicators[key][this.indicators[key].length - 1];
    }

    return result;
  }

  /**
   * Get all indicator values from current candle
   */
  getLatestIndicator(key) {
    for (const k in this.indicators) {
      if (k === key) {
        return this.indicators[key][this.indicators[key].length - 1];
      }
    }

    return undefined;
  }
};
