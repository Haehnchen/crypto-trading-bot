const _ = require('lodash');
const OrderCapital = require('../../dict/order_capital');

module.exports = class PairConfig {
  constructor(instances) {
    this.instances = instances;
  }

  /**
   * @param exchangeName string
   * @param symbol string
   * @returns OrderCapital
   */
  getSymbolCapital(exchangeName, symbol) {
    const capital = this.instances.symbols.find(
      instance =>
        instance.exchange === exchangeName && instance.symbol === symbol && _.get(instance, 'trade.capital', 0) > 0
    );

    if (capital) {
      return OrderCapital.createAsset(capital.trade.capital);
    }

    const capitalCurrency = this.instances.symbols.find(
      instance =>
        instance.exchange === exchangeName &&
        instance.symbol === symbol &&
        _.get(instance, 'trade.currency_capital', 0) > 0
    );

    if (capitalCurrency) {
      return OrderCapital.createCurrency(capitalCurrency.trade.currency_capital);
    }

    return undefined;
  }
};
