export interface OrderbookLevel {
  price: number;
  amount: number;
}

export class Orderbook {
  constructor(public asks: OrderbookLevel[], public bids: OrderbookLevel[]) {}
}
