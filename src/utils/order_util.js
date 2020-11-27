const ExchangeOrder = require('../dict/exchange_order');

module.exports = {
  calculateOrderAmount: (price, capital) => {
    return capital / price;
  },

  syncOrderByType: (position, orders, type) => {
    const stopOrders = orders.filter(order => order.type === type);
    if (stopOrders.length === 0) {
      return [
        {
          amount: Math.abs(position.amount)
        }
      ];
    }

    const stopOrder = stopOrders[0];

    // only update if we 1 % out of range; to get not unit amount lot size issues
    if (module.exports.isPercentDifferentGreaterThen(position.amount, stopOrder.amount, 1)) {
      return [
        {
          id: stopOrder.id,
          amount: position.amount
        }
      ];
    }

    return [];
  },

  syncStopLossOrder: (position, orders) => {
    return module.exports.syncOrderByType(position, orders, ExchangeOrder.TYPE_STOP);
  },

  syncTrailingStopLossOrder: (position, orders) => {
    return module.exports.syncOrderByType(position, orders, ExchangeOrder.TYPE_TRAILING_STOP);
  },

  /**
   * LTC: "0.008195" => "0.00820"
   *
   * @param num 0.008195
   * @param tickSize 0.00001
   * @returns {*}
   */
  calculateNearestSize: (num, tickSize) => {
    const number = Math.trunc(num / tickSize) * tickSize;

    // fix float issues:
    // 0.0085696 => 0.00001 = 0.00857000...001
    const points = tickSize.toString().split('.');
    if (points.length < 2) {
      return number;
    }

    return number.toFixed(points[1].length);
  },

  isPercentDifferentGreaterThen: (value1, value2, percentDiff) => {
    // we dont care about negative values
    const value1Abs = Math.abs(value1);
    const value2Abs = Math.abs(value2);

    return Math.abs((value1Abs - value2Abs) / ((value1Abs + value2Abs) / 2)) * 100 > percentDiff;
  },

  /**
   * Percent different between to values, independent of smaller or bigger
   * @param orderPrice
   * @param currentPrice
   * @returns {number}
   */
  getPercentDifferent: (orderPrice, currentPrice) => {
    return orderPrice > currentPrice
      ? 100 - (currentPrice / orderPrice) * 100
      : 100 - (orderPrice / currentPrice) * 100;
  }
};
