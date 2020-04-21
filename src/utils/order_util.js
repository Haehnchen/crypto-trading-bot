const ExchangeOrder = require('../dict/exchange_order');

module.exports = {
  calculateOrderAmount: (price, capital) => {
    return capital / price;
  },

  syncOrderByType: (position, orders, type) => {
    const stopOrders = orders.filter(order => order.type === type)
    if (stopOrders.length === 0) {
      return [
        {
          amount: Math.abs(position.amount)
        }
      ];
    }

    const stopOrder = stopOrders[0];
    const difference = Math.abs(position.amount) - Math.abs(stopOrder.amount);

    if (difference === 0) {
      return [];
    }

    // only update if we 1 % out of range; to get not unit amount lot size issues
    const differencePercent = Math.abs(((Math.abs(position.amount) - Math.abs(difference)) / position.amount) * 100);
    if (differencePercent >= 1) {
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
  }
};
