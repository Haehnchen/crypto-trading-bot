module.exports = class IndicatorBuilder {
  constructor() {
    this.indicators = {};
  }

  add(key, indicator, period, options = {}, source) {
    this.indicators[key] = {
      indicator: indicator,
      key: key,
      period: period,
      source: source,
      options: options
    };
  }

  all() {
    return Object.keys(this.indicators).map(key => this.indicators[key]);
  }
};
