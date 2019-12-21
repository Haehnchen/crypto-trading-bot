const Order = require('../../dict/order');
const ExchangeOrder = require('../../dict/exchange_order');

module.exports = class RiskRewardRatioCalculator {
  constructor(logger) {
    this.logger = logger;
  }

  async calculateForOpenPosition(position, options = { stop_percent: 3, target_percent: 6 }) {
    return new Promise(resolve => {
      let entryPrice = position.entry;
      if (!entryPrice) {
        this.logger.info(`Invalid position entryPrice for stop loss:${JSON.stringify(position)}`);
        resolve();

        return;
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

      resolve(result);
    });
  }

  async syncRatioRewardOrders(position, orders, options) {
    const newOrders = {};

    const riskRewardRatio = await this.calculateForOpenPosition(position, options);

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
      const difference = Math.abs(Math.abs(position.amount) - Math.abs(stopOrder.amount));
      if (
        difference !== 0 &&
        Math.abs(((Math.abs(position.amount) - Math.abs(difference)) / position.amount) * 100) >= 1
      ) {
        newOrders.stop = {
          id: stopOrder.id,
          amount: Math.abs(position.amount)
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
      const difference = Math.abs(Math.abs(position.amount) - Math.abs(targetOrder.amount));
      if (
        difference !== 0 &&
        Math.abs(((Math.abs(position.amount) - Math.abs(difference)) / position.amount) * 100) >= 1
      ) {
        newOrders.target = {
          id: targetOrder.id,
          amount: Math.abs(position.amount)
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
        newOrders.push(ratioOrders.target);
      } else {
        newOrders.push(
          Order.createCloseLimitPostOnlyReduceOrder(
            position.symbol,
            ratioOrders.target.price,
            ratioOrders.target.amount
          )
        );
      }
    }

    if (ratioOrders.stop) {
      if (ratioOrders.stop.id) {
        newOrders.push(ratioOrders.stop);
      } else {
        newOrders.push(Order.createStopLossOrder(position.symbol, ratioOrders.stop.price, ratioOrders.stop.amount));
      }
    }

    return newOrders;
  }
};
