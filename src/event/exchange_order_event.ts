import { ExchangeOrder } from '../dict/exchange_order';

export class ExchangeOrderEvent {
  exchange: string;
  order: ExchangeOrder;

  constructor(exchange: string, order: ExchangeOrder) {
    this.exchange = exchange;
    this.order = order;
  }
}
