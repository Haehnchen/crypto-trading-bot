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

    const balancePercent = this.instances.symbols.find(
      instance =>
        instance.exchange === exchangeName &&
        instance.symbol === symbol &&
        _.get(instance, 'trade.balance_percent', 0) > 0
    );

    if (balancePercent) {
      return OrderCapital.createBalance(balancePercent.trade.balance_percent);
    }

    return undefined;
  }

  /**
   * Get all instance pairs sorted
   *
   * @returns string[]
   */
  getAllPairNames() {
    const pairs = [];

    this.instances.symbols.forEach(symbol => {
      pairs.push(`${symbol.exchange}.${symbol.symbol}`);
    });

    return pairs.sort();
  }
};
