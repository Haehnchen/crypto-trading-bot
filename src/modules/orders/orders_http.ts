import { Order } from '../../dict/order';
import { ExchangeOrder } from '../../dict/exchange_order';
import { Tickers } from '../../storage/tickers';
import { ExchangeManager } from '../exchange/exchange_manager';
import { PairConfig } from '../pairs/pair_config';
import { Backtest, OrderExecutor } from '../services';

export class OrdersHttp {
  private backtest: Backtest;
  private tickers: Tickers;
  private orderExecutor: OrderExecutor;
  private exchangeManager: ExchangeManager;
  private pairConfig: PairConfig;

  constructor(
    backtest: Backtest,
    tickers: Tickers,
    orderExecutor: OrderExecutor,
    exchangeManager: ExchangeManager,
    pairConfig: PairConfig
  ) {
    this.backtest = backtest;
    this.tickers = tickers;
    this.orderExecutor = orderExecutor;
    this.exchangeManager = exchangeManager;
    this.pairConfig = pairConfig;
  }

  getPairs(): string[] {
    return this.pairConfig.getAllPairNames();
  }

  getOrders(pair: string): Promise<ExchangeOrder[]> {
    const res = pair.split('.');
    return this.exchangeManager.getOrders(res[0], res[1]);
  }

  async cancel(pair: string, id: string): Promise<any> {
    const res = pair.split('.');

    return this.orderExecutor.cancelOrder(res[0], id);
  }

  async cancelAll(pair: string): Promise<void> {
    const res = pair.split('.');

    const orders = await this.exchangeManager.getOrders(res[0], res[1]);

    for (const order of orders) {
      await this.orderExecutor.cancelOrder(res[0], String(order.id));
    }
  }

  getTicker(pair: string): any {
    const res = pair.split('.');
    return this.tickers.get(res[0], res[1]);
  }

  async createOrder(pair: string, order: any): Promise<any> {
    const res = pair.split('.');

    const exchangeInstance = this.exchangeManager.get(res[0]);

    let orderAmount = parseFloat(order.amount);

    // support inverse contracts
    if (exchangeInstance.isInverseSymbol(res[1])) {
      orderAmount = parseFloat(order.amount_currency);
    }

    const amount = exchangeInstance.calculateAmount(orderAmount, res[1]);
    if (amount) {
      orderAmount = amount;
    }

    let orderPrice = parseFloat(order.price);
    const price = exchangeInstance.calculatePrice(orderPrice, res[1]);
    if (price) {
      orderPrice = price;
    }

    let ourOrder: Order;
    if (order.type && order.type === 'stop') {
      ourOrder = Order.createStopOrder(res[1], order.side, orderPrice, orderAmount);
    } else {
      ourOrder = Order.createLimitPostOnlyOrder(res[1], order.side, orderPrice, orderAmount);
    }

    return this.orderExecutor.executeOrder(res[0], ourOrder);
  }
}
