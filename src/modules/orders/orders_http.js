const Order = require('../../dict/order');

module.exports = class OrdersHttp {
  constructor(backtest, tickers, orderExecutor, exchangeManager, pairConfig) {
    this.backtest = backtest;
    this.tickers = tickers;
    this.orderExecutor = orderExecutor;
    this.exchangeManager = exchangeManager;
    this.pairConfig = pairConfig;
  }

  getPairs() {
    return this.pairConfig.getAllPairNames();
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

    const exchangeInstance = this.exchangeManager.get(res[0]);

    let orderAmount = parseFloat(order.amount);

    // support inverse contracts
    if (exchangeInstance.isInverseSymbol(res[1])) {
      orderAmount = parseFloat(order.amount_currency);
    }

    const amount = exchangeInstance.calculateAmount(orderAmount, res[1]);
    if (amount) {
      orderAmount = parseFloat(amount);
    }

    let orderPrice = parseFloat(order.price);
    const price = exchangeInstance.calculatePrice(orderPrice, res[1]);
    if (price) {
      orderPrice = parseFloat(price);
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
