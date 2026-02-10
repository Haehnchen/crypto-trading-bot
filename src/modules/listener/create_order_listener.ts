import { OrderEvent } from '../../event/order_event';
import { ExchangeManager } from '../exchange/exchange_manager';

export class CreateOrderListener {
  private exchangeManager: ExchangeManager;
  private logger: any;

  constructor(exchangeManager: ExchangeManager, logger: any) {
    this.exchangeManager = exchangeManager;
    this.logger = logger;
  }

  async onCreateOrder(orderEvent: OrderEvent): Promise<void> {
    this.logger.debug(`Create Order:${JSON.stringify(orderEvent)}`);

    const exchange = this.exchangeManager.get(orderEvent.exchange);
    if (!exchange) {
      console.log(`order: unknown exchange:${orderEvent.exchange}`);
      return;
    }

    // filter same direction
    const ordersForSymbol = (await exchange.getOrdersForSymbol(orderEvent.order.symbol)).filter((order: any) => {
      return order.side === orderEvent.order.side;
    });

    if (ordersForSymbol.length === 0) {
      this.triggerOrder(exchange, orderEvent.order);
      return;
    }

    this.logger.debug(`Info Order update:${JSON.stringify(orderEvent)}`);

    const currentOrder = ordersForSymbol[0];

    if (String(currentOrder.side) !== String(orderEvent.order.side)) {
      console.log('order side change');
      return;
    }

    exchange
      .updateOrder(String(currentOrder.id), orderEvent.order)
      .then((order: any) => {
        console.log(`OderUpdate:${JSON.stringify(order)}`);
      })
      .catch(() => {
        console.log('order update error');
      });
  }

  triggerOrder(exchange: any, order: any, retry: number = 0): void {
    if (retry > 3) {
      console.log(`Retry limit stop creating order: ${JSON.stringify(order)}`);
      return;
    }

    if (retry > 0) {
      console.log(`Retry (${retry}) creating order: ${JSON.stringify(order)}`);
    }

    exchange
      .order(order)
      .then((resultOrder: any) => {
        if (resultOrder.status === 'rejected') {
          setTimeout(() => {
            console.log(`Order rejected: ${JSON.stringify(resultOrder)}`);
            this.triggerOrder(exchange, resultOrder, retry + 1);
          }, 1500);

          return;
        }

        console.log(`Order created: ${JSON.stringify(resultOrder)}`);
      })
      .catch((e: any) => {
        console.log(e);
        console.log(`Order create error: ${JSON.stringify(e)} - ${JSON.stringify(order)}`);
      });
  }
}
