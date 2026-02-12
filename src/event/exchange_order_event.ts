import { ExchangeOrder } from '../dict/exchange_order';

export class ExchangeOrderEvent {
  constructor(
    public exchange: string,
    public order: ExchangeOrder
  ) {}
}
