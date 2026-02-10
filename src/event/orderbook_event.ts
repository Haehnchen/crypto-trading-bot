import { Orderbook } from '../dict/orderbook';

export class OrderbookEvent {
  exchange: string;
  symbol: string;
  orderbook: Orderbook;

  constructor(exchange: string, symbol: string, orderbook: Orderbook) {
    this.exchange = exchange;
    this.symbol = symbol;
    this.orderbook = orderbook;
  }
}
