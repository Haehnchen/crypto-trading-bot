import { Orderbook } from '../dict/orderbook';

export class OrderbookEvent {
  constructor(
    public exchange: string,
    public symbol: string,
    public orderbook: Orderbook
  ) {}
}
