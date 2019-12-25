const _ = require('lodash');

module.exports = class PairConfig {
  constructor(instances) {
    this.instances = instances;
  }

  /**
   * @param exchangeName string
   * @param symbol string
   * @returns {{currency: *, asset: *}}
   */
  getSymbolCapital(exchangeName, symbol) {
    const c = {
      asset: undefined,
      currency: undefined
    };

    const capital = this.instances.symbols.find(
      instance =>
        instance.exchange === exchangeName && instance.symbol === symbol && _.get(instance, 'trade.capital', 0) > 0
    );

    if (capital) {
      c.asset = capital.trade.capital;
    }

    const capitalCurrency = this.instances.symbols.find(
      instance =>
        instance.exchange === exchangeName &&
        instance.symbol === symbol &&
        _.get(instance, 'trade.currency_capital', 0) > 0
    );

    if (capitalCurrency) {
      c.currency = capitalCurrency.trade.currency_capital;
    }

    if (!c.asset && !c.currency) {
      return undefined;
    }

    return c;
  }
};
