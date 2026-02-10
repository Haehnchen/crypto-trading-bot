import { ExchangeOrder } from '../dict/exchange_order';

export class ExchangeOrdersEvent {
  exchange: string;
  orders: ExchangeOrder[];

  constructor(exchange: string, orders: ExchangeOrder[]) {
    this.exchange = exchange;
    this.orders = orders;
  }
}
