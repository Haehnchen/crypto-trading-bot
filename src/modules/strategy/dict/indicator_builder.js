module.exports = class IndicatorBuilder {
  constructor() {
    this.indicators = {};
  }

  add(key, indicator, period, options) {
    this.indicators[key] = {
      indicator: indicator,
      key: key,
      period: period,
      options: options || {}
    };
  }

  all() {
    const indicators = [];

    for (const key in this.indicators) {
      indicators.push(this.indicators[key]);
    }

    return indicators;
  }
};
