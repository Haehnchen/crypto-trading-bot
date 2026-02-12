import { ExchangeOrder } from '../dict/exchange_order';

export class ExchangeOrdersEvent {
  constructor(
    public exchange: string,
    public orders: ExchangeOrder[]
  ) {}
}
