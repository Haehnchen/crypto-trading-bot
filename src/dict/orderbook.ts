export interface OrderbookLevel {
  price: number;
  amount: number;
}

export class Orderbook {
  asks: OrderbookLevel[];
  bids: OrderbookLevel[];

  constructor(asks: OrderbookLevel[], bids: OrderbookLevel[]) {
    this.asks = asks;
    this.bids = bids;
  }
}
