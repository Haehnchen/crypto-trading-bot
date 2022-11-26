const _ = require('lodash');
const moment = require('moment');
const Order = require('../../dict/order');
const PairState = require('../../dict/pair_state');
const ExchangeOrder = require('../../dict/exchange_order');

module.exports = class OrderExecutor {
  constructor(exchangeManager, tickers, systemUtil, logger) {
    this.exchangeManager = exchangeManager;
    this.tickers = tickers;
    this.logger = logger;
    this.systemUtil = systemUtil;
    this.runningOrders = {};

    this.tickerPriceInterval = 200;
    this.tickerPriceRetries = 40;
  }

  /**
   * Keep open orders in orderbook at first position
   */
  adjustOpenOrdersPrice(...pairStates) {
    for (const orderId in this.runningOrders) {
      if (this.runningOrders[orderId] < moment().subtract(2, 'minutes')) {
        this.logger.debug(`OrderAdjust: adjustOpenOrdersPrice timeout cleanup: ${JSON.stringify([orderId, this.runningOrders[orderId]])}`);

        delete this.runningOrders[orderId];
      }
    }

    const visitExchangeOrder = async pairState => {
      if (!pairState.hasAdjustedPrice()) {
        return;
      }

      const exchange = this.exchangeManager.get(pairState.getExchange());

      const exchangeOrder = pairState.getExchangeOrder();
      if (!exchangeOrder) {
        return;
      }

      if (exchangeOrder.id in this.runningOrders) {
        this.logger.info(`OrderAdjust: already running: ${JSON.stringify([exchangeOrder.id, pairState.getExchange(), pairState.getSymbol()])}`);
        return;
      }

      this.runningOrders[exchangeOrder.id] = new Date();

      const price = await this.getCurrentPrice(pairState.getExchange(), pairState.getSymbol(), exchangeOrder.getLongOrShortSide());
      if (!price) {
        this.logger.info(
          `OrderAdjust: No up to date ticker price found: ${JSON.stringify([
            exchangeOrder.id,
            pairState.getExchange(),
            pairState.getSymbol(),
            exchangeOrder.getLongOrShortSide()
          ])}`
        );

        delete this.runningOrders[exchangeOrder.id];

        return;
      }

      // order not known by exchange cleanup
      const lastExchangeOrder = await exchange.findOrderById(exchangeOrder.id);
      if (!lastExchangeOrder || lastExchangeOrder.status !== ExchangeOrder.STATUS_OPEN) {
        this.logger.debug(
          `OrderAdjust: managed order does not exists maybe filled; cleanup: ${JSON.stringify([
            exchangeOrder.id,
            pairState.getExchange(),
            pairState.getSymbol(),
            lastExchangeOrder
          ])}`
        );

        delete this.runningOrders[exchangeOrder.id];

        return;
      }

      const orderUpdate = Order.createPriceUpdateOrder(exchangeOrder.id, price, exchangeOrder.getLongOrShortSide());

      // normalize prices for positions compare; we can have negative prices depending on "side"
      if (Math.abs(lastExchangeOrder.price) === Math.abs(price)) {
        this.logger.info(
          `OrderAdjust: No price update needed:${JSON.stringify([
            lastExchangeOrder.id,
            Math.abs(lastExchangeOrder.price),
            Math.abs(price),
            pairState.getExchange(),
            pairState.getSymbol()
          ])}`
        );
        delete this.runningOrders[exchangeOrder.id];

        return;
      }

      try {
        const updatedOrder = await exchange.updateOrder(orderUpdate.id, orderUpdate);

        if (updatedOrder && updatedOrder.status === ExchangeOrder.STATUS_OPEN) {
          this.logger.info(
            `OrderAdjust: Order adjusted with orderbook price: ${JSON.stringify([
              updatedOrder.id,
              Math.abs(lastExchangeOrder.price),
              Math.abs(price),
              pairState.getExchange(),
              pairState.getSymbol(),
              updatedOrder
            ])}`
          );
          pairState.setExchangeOrder(updatedOrder);
        } else if (updatedOrder && updatedOrder.status === ExchangeOrder.STATUS_CANCELED && updatedOrder.retry === true) {
          // we update the price outside the orderbook price range on PostOnly we will cancel the order directly
          this.logger.error(`OrderAdjust: Updated order canceled recreate: ${JSON.stringify(pairState, updatedOrder)}`);

          // recreate order
          // @TODO: resync used balance in case on order is partially filled

          const amount =
            lastExchangeOrder.getLongOrShortSide() === ExchangeOrder.SIDE_LONG
              ? Math.abs(lastExchangeOrder.amount)
              : Math.abs(lastExchangeOrder.amount) * -1;

          // create a retry order with the order amount we had before; eg if partially filled
          const retryOrder =
            pairState.getState() === PairState.STATE_CLOSE
              ? Order.createCloseOrderWithPriceAdjustment(pairState.getSymbol(), amount)
              : Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder(pairState.getSymbol(), amount);

          this.logger.error(`OrderAdjust: replacing canceled order: ${JSON.stringify(retryOrder)}`);

          const exchangeOrder = await this.executeOrder(pairState.getOrder(), retryOrder);
          pairState.setExchangeOrder(exchangeOrder);
        } else {
          this.logger.error(`OrderAdjust: Unknown order state: ${JSON.stringify([pairState, updatedOrder])}`);
        }
      } catch (err) {
        this.logger.error(`OrderAdjust: adjusted failed: ${JSON.stringify([String(err), pairState, orderUpdate])}`);
      }

      delete this.runningOrders[exchangeOrder.id];
    };

    return Promise.all(pairStates.map(pairState => visitExchangeOrder(pairState)));
  }

  /**
   * Exchanges need "amount" and "price" to be normalized for creating orders, allow this to happen here
   *
   * @param exchangeName
   * @param {Order} order
   * @returns {Promise<unknown>}
   */
  executeOrderWithAmountAndPrice(exchangeName, order) {
    const exchangeInstance = this.exchangeManager.get(exchangeName);
    if (!exchangeInstance) {
      this.logger.error(`executeOrderWithAmountAndPrice: Invalid exchange: ${exchangeName}`);
      return undefined;
    }

    const amount = exchangeInstance.calculateAmount(order.getAmount(), order.getSymbol());
    if (amount) {
      order.amount = parseFloat(amount);
    }

    const price = exchangeInstance.calculatePrice(order.getPrice(), order.getSymbol());
    if (price) {
      order.price = parseFloat(price);
    }

    return this.executeOrder(exchangeName, order);
  }

  executeOrder(exchangeName, order) {
    return new Promise(async resolve => {
      await this.triggerOrder(resolve, exchangeName, order);
    });
  }

  async cancelOrder(exchangeName, orderId) {
    const exchange = this.exchangeManager.get(exchangeName);
    if (!exchange) {
      console.error(`CancelOrder: Invalid exchange: ${exchangeName}`);
      return undefined;
    }

    try {
      const order = await exchange.cancelOrder(orderId);
      this.logger.info(`Order canceled: ${orderId}`);
      return order;
    } catch (err) {
      this.logger.error(`Order cancel error: ${orderId} ${err}`);
    }

    return undefined;
  }

  async cancelAll(exchangeName, symbol) {
    const exchange = this.exchangeManager.get(exchangeName);

    try {
      return await exchange.cancelAll(symbol);
    } catch (err) {
      this.logger.error(`Order cancel all error: ${JSON.stringify([symbol, err])}`);
    }

    return undefined;
  }

  async triggerOrder(resolve, exchangeName, order, retry = 0) {
    if (retry > this.systemUtil.getConfig('order.retry', 4)) {
      this.logger.error(`Retry (${retry}) creating order reached: ${JSON.stringify(order)}`);
      resolve();
      return;
    }

    if (retry > 0) {
      this.logger.info(`Retry (${retry}) creating order: ${JSON.stringify(order)}`);
    }

    const exchange = this.exchangeManager.get(exchangeName);
    if (!exchange) {
      console.error(`triggerOrder: Invalid exchange: ${exchangeName}`);

      resolve();
      return;
    }

    if (order.hasAdjustedPrice() === true) {
      order = await this.createAdjustmentOrder(exchangeName, order);

      if (!order) {
        this.logger.error(`Order price adjust failed:${JSON.stringify([exchangeName, order])}`);
        resolve();
        return;
      }
    }

    let exchangeOrder;
    try {
      exchangeOrder = await exchange.order(order);
    } catch (err) {
      this.logger.error(`Order create canceled:${JSON.stringify(order)} - ${JSON.stringify(String(err))}`);

      resolve();
      return;
    }

    if (!exchangeOrder) {
      this.logger.error('Order create canceled no exchange return');

      resolve();
      return;
    }

    if (exchangeOrder.status === 'canceled' && exchangeOrder.retry === false) {
      this.logger.error(`Order create canceled:${JSON.stringify(order)} - ${JSON.stringify(exchangeOrder)}`);

      resolve(exchangeOrder);
      return;
    }

    if (exchangeOrder.retry === true) {
      this.logger.info(`Order not placed force retry: ${JSON.stringify(exchangeOrder)}`);

      setTimeout(async () => {
        const retryOrder = Order.createRetryOrder(order);

        await this.triggerOrder(resolve, exchangeName, retryOrder, ++retry);
      }, this.systemUtil.getConfig('order.retry_ms', 1500));

      return;
    }

    this.logger.info(`Order created: ${JSON.stringify([exchangeOrder.id, exchangeName, exchangeOrder.symbol, order, exchangeOrder])}`);
    console.log(`Order created: ${JSON.stringify([exchangeOrder.id, exchangeName, exchangeOrder.symbol])}`);

    resolve(exchangeOrder);
  }

  /**
   * Follow orderbook aks / bid to be the first on the list
   *
   * @param exchangeName
   * @param order
   * @returns {Promise<*>}
   */
  async createAdjustmentOrder(exchangeName, order) {
    const price = await this.getCurrentPrice(exchangeName, order.symbol, order.side);
    if (!price) {
      this.logger.error(`Stop creating order; can not find up to date ticker price: ${JSON.stringify([exchangeName, order.symbol, order.side])}`);
      return undefined;
    }

    return Order.createRetryOrderWithPriceAdjustment(order, price);
  }

  /**
   * Get current price based on the ticker. This function is block and waiting until getting an up to date ticker price
   *
   * @param exchangeName
   * @param symbol
   * @param side
   * @returns {Promise<any>}
   */
  getCurrentPrice(exchangeName, symbol, side) {
    if (!['long', 'short'].includes(side)) {
      throw new Error(`Invalid side: ${side}`);
    }

    return new Promise(async resolve => {
      const wait = time =>
        new Promise(resolve2 => {
          setTimeout(() => {
            resolve2();
          }, time);
        });

      let ticker;

      for (let retry = 0; retry < this.tickerPriceRetries; retry++) {
        ticker = this.tickers.getIfUpToDate(exchangeName, symbol, 10000);
        if (ticker) {
          break;
        }

        await wait(this.tickerPriceInterval);
      }

      // fallback
      if (!ticker) {
        ticker = this.tickers.get(exchangeName, symbol);
      }

      if (!ticker) {
        this.logger.error(`OrderExecutor: ticker price not found: ${JSON.stringify([exchangeName, symbol, side])}`);
        resolve();
        return;
      }

      let price = ticker.bid;
      if (side === 'short') {
        price = ticker.ask * -1;
      }

      resolve(price);
    });
  }
};
