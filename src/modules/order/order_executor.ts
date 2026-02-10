import _ from 'lodash';
import moment from 'moment';
import { Order } from '../../dict/order';
import { PairState } from '../../dict/pair_state';
import { ExchangeOrder } from '../../dict/exchange_order';
import { Tickers } from '../../storage/tickers';

export class OrderExecutor {
  private exchangeManager: any;
  private tickers: Tickers;
  private logger: any;
  private systemUtil: any;
  private runningOrders: Record<string | number, Date>;
  private tickerPriceInterval: number;
  private tickerPriceRetries: number;

  constructor(exchangeManager: any, tickers: Tickers, systemUtil: any, logger: any) {
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
  adjustOpenOrdersPrice(...pairStates: PairState[]): void {
    for (const orderId in this.runningOrders) {
      if (this.runningOrders[orderId] < moment().subtract(2, 'minutes').toDate()) {
        this.logger.debug(`OrderAdjust: adjustOpenOrdersPrice timeout cleanup: ${JSON.stringify([orderId, this.runningOrders[orderId]])}`);

        delete this.runningOrders[orderId];
      }
    }

    const visitExchangeOrder = async (pairState: PairState) => {
      if (!pairState.hasAdjustedPrice()) {
        return;
      }

      const exchange = this.exchangeManager.get(pairState.getExchange());

      const exchangeOrder: ExchangeOrder | undefined = pairState.getExchangeOrder();
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
        this.logger.error(`OrderAdjust: stop adjusting order; can not find up to date ticker price: ${JSON.stringify([pairState.getExchange(), pairState.getSymbol(), exchangeOrder.getLongOrShortSide()])}`);
        delete this.runningOrders[exchangeOrder.id];
        return;
      }

      const currentOrderPrice = exchangeOrder.price;
      const percentPriceDifference = Math.abs(((currentOrderPrice - price) / price) * 100);

      if (percentPriceDifference > this.systemUtil.getConfig('order.adjust_price_diff', 0.15)) {
        this.logger.info(`OrderAdjust: adjusting order price: ${JSON.stringify([percentPriceDifference, exchangeOrder.id, pairState.getExchange(), pairState.getSymbol(), currentOrderPrice, price])}`);

        try {
          const order = Order.createUpdateOrderOnCurrent(exchangeOrder, price);
          await exchange.order(order);
        } catch (err) {
          this.logger.error(`OrderAdjust: error updating order: ${JSON.stringify([exchangeOrder.id, err])}`);
        }

        delete this.runningOrders[exchangeOrder.id];
      } else {
        delete this.runningOrders[exchangeOrder.id];
      }
    };

    pairStates.forEach(pairState => {
      visitExchangeOrder(pairState);
    });
  }

  /**
   * Exchanges need "amount" and "price" to be normalized for creating orders, allow this to happen here
   *
   * @param exchangeName
   * @param {Order} order
   * @returns {Promise<unknown>}
   */
  executeOrderWithAmountAndPrice(exchangeName: string, order: Order): Promise<any> {
    const exchangeInstance = this.exchangeManager.get(exchangeName);
    if (!exchangeInstance) {
      this.logger.error(`executeOrderWithAmountAndPrice: Invalid exchange: ${exchangeName}`);
      return Promise.resolve(undefined);
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

  executeOrder(exchangeName: string, order: Order): Promise<any> {
    return new Promise(async resolve => {
      await this.triggerOrder(resolve, exchangeName, order);
    });
  }

  async cancelOrder(exchangeName: string, orderId: string): Promise<any> {
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

  async cancelAll(exchangeName: string, symbol: string): Promise<any> {
    const exchange = this.exchangeManager.get(exchangeName);

    try {
      return await exchange.cancelAll(symbol);
    } catch (err) {
      this.logger.error(`Order cancel all error: ${JSON.stringify([symbol, err])}`);
    }

    return undefined;
  }

  async triggerOrder(resolve: (value?: any) => void, exchangeName: string, order: Order, retry: number = 0): Promise<void> {
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
      const adjustedOrder = await this.createAdjustmentOrder(exchangeName, order);

      if (!adjustedOrder) {
        this.logger.error(`Order price adjust failed:${JSON.stringify([exchangeName, order])}`);
        resolve();
        return;
      }

      order = adjustedOrder;
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
  async createAdjustmentOrder(exchangeName: string, order: Order): Promise<Order | undefined> {
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
  getCurrentPrice(exchangeName: string, symbol: string, side: string): Promise<number | undefined> {
    if (!['long', 'short'].includes(side)) {
      throw new Error(`Invalid side: ${side}`);
    }

    return new Promise(async resolve => {
      const wait = (time: number) =>
        new Promise<void>(resolve2 => {
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
        resolve(undefined);
        return;
      }

      let price = ticker.bid;
      if (side === 'short') {
        price = ticker.ask * -1;
      }

      resolve(price);
    });
  }
}
