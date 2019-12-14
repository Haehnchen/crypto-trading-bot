const ExchangeOrder = require('../dict/exchange_order');

module.exports = {
  calculateOrderAmount: (price, capital) => {
    return capital / price;
  },

  syncStopLossOrder: (position, orders) => {
    if (orders.filter(order => order.type === ExchangeOrder.TYPE_STOP).length === 0) {
      return [
        {
          amount: Math.abs(position.amount)
        }
      ];
    }

    const stopOrder = orders.find(order => order.type === ExchangeOrder.TYPE_STOP);

    const difference = Math.abs(position.amount) - Math.abs(stopOrder.amount);

    if (difference !== 0) {
      return [
        {
          id: stopOrder.id,
          amount: position.amount
        }
      ];
    }

    return [];
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
