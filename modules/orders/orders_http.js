const _ = require('lodash');

const Order = require('../../dict/order');

module.exports = class OrdersHttp {
  constructor(backtest, tickers, orderExecutor, exchangeManager) {
    this.backtest = backtest;
    this.tickers = tickers;
    this.orderExecutor = orderExecutor;
    this.exchangeManager = exchangeManager;
  }

  getPairs() {
    return this.backtest.getBacktestPairs();
  }

  getOrders(pair) {
    const res = pair.split('.');
    return this.exchangeManager.getOrders(res[0], res[1]);
  }

  async cancel(pair, id) {
    const res = pair.split('.');

    return this.orderExecutor.cancelOrder(res[0], id);
  }

  async cancelAll(pair) {
    const res = pair.split('.');

    const orders = await this.exchangeManager.getOrders(res[0], res[1]);

    for (const order of orders) {
      await this.orderExecutor.cancelOrder(res[0], order.id);
    }
  }

  getTicker(pair) {
    const res = pair.split('.');
    return this.tickers.get(res[0], res[1]);
  }

  async createOrder(pair, order) {
    const res = pair.split('.');

    let orderAmount = parseFloat(order.amount);
    const amount = this.exchangeManager.get(res[0]).calculateAmount(orderAmount, res[1]);
    if (amount) {
      orderAmount = amount;
    }

    let orderPrice = parseFloat(order.price);
    const price = this.exchangeManager.get(res[0]).calculatePrice(orderPrice, res[1]);
    if (price) {
      orderPrice = price;
    }

    let ourOrder;
    if (order.type && order.type === 'stop') {
      ourOrder = Order.createStopOrder(res[1], order.side, orderPrice, orderAmount);
    } else {
      ourOrder = Order.createLimitPostOnlyOrder(res[1], order.side, orderPrice, orderAmount);
    }

    return this.orderExecutor.executeOrder(res[0], ourOrder);
  }
};
