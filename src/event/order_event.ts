import { Order } from '../dict/order';

export class OrderEvent {
  exchange: string;
  order: Order;

  constructor(exchange: string, order: Order) {
    this.exchange = exchange;
    this.order = order;
  }
}
