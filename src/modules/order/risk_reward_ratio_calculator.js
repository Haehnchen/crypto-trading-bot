const Order = require('../../dict/order');
const ExchangeOrder = require('../../dict/exchange_order');
const OrderUtil = require('../../utils/order_util');

module.exports = class RiskRewardRatioCalculator {
  constructor(logger) {
    this.logger = logger;
  }

  calculateForOpenPosition(position, options = { stop_percent: 3, target_percent: 6 }) {
    let entryPrice = position.entry;
    if (!entryPrice) {
      this.logger.info(`Invalid position entryPrice for stop loss:${JSON.stringify(position)}`);
      return undefined;
    }

    const result = {
      stop: undefined,
      target: undefined
    };

    entryPrice = Math.abs(entryPrice);

    if (position.side === 'long') {
      result.target = entryPrice * (1 + options.target_percent / 100);
      result.stop = entryPrice * (1 - options.stop_percent / 100);
    } else {
      result.target = entryPrice * (1 - options.target_percent / 100);
      result.stop = entryPrice * (1 + options.stop_percent / 100);
    }

    return result;
  }

  async syncRatioRewardOrders(position, orders, options) {
    const newOrders = {};

    const riskRewardRatio = this.calculateForOpenPosition(position, options);

    const stopOrders = orders.filter(order => order.type === ExchangeOrder.TYPE_STOP);
    if (stopOrders.length === 0) {
      newOrders.stop = {
        amount: Math.abs(position.amount),
        price: riskRewardRatio.stop
      };

      // inverse price for lose long position via sell
      if (position.side === 'long') {
        newOrders.stop.price = newOrders.stop.price * -1;
      }
    } else {
      // update order
      const stopOrder = stopOrders[0];

      // only +1% amount change is important for us
      if (OrderUtil.isPercentDifferentGreaterThen(position.amount, stopOrder.amount, 1)) {
        let amount = Math.abs(position.amount);
        if (position.isLong()) {
          amount *= -1;
        }

        newOrders.stop = {
          id: stopOrder.id,
          amount: amount
        };
      }
    }

    const targetOrders = orders.filter(order => order.type === ExchangeOrder.TYPE_LIMIT);
    if (targetOrders.length === 0) {
      newOrders.target = {
        amount: Math.abs(position.amount),
        price: riskRewardRatio.target
      };

      // inverse price for lose long position via sell
      if (position.side === 'long') {
        newOrders.target.price = newOrders.target.price * -1;
      }
    } else {
      // update order
      const targetOrder = targetOrders[0];

      // only +1% amount change is important for us
      if (OrderUtil.isPercentDifferentGreaterThen(position.amount, targetOrder.amount, 1)) {
        let amount = Math.abs(position.amount);
        if (position.isLong()) {
          amount *= -1;
        }

        newOrders.target = {
          id: targetOrder.id,
          amount: amount
        };
      }
    }

    return newOrders;
  }

  async createRiskRewardOrdersOrders(position, orders, options) {
    const ratioOrders = await this.syncRatioRewardOrders(position, orders, options);

    const newOrders = [];
    if (ratioOrders.target) {
      if (ratioOrders.target.id) {
        newOrders.push({
          id: ratioOrders.target.id,
          price: ratioOrders.target.price,
          amount: ratioOrders.target.amount
        });
      } else {
        newOrders.push({
          price: ratioOrders.target.price || undefined,
          amount: ratioOrders.target.amount || undefined,
          type: 'target'
        });
      }
    }

    if (ratioOrders.stop) {
      if (ratioOrders.stop.id) {
        newOrders.push({
          id: ratioOrders.stop.id,
          price: ratioOrders.stop.price,
          amount: ratioOrders.stop.amount
        });
      } else {
        newOrders.push({
          price: ratioOrders.stop.price,
          amount: ratioOrders.stop.amount,
          type: 'stop'
        });
      }
    }

    return newOrders;
  }
};
