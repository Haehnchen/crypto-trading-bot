export class Signal {
  id: string;
  exchange: string;
  symbol: string;
  side: string;
  income_at: number;

  constructor(id: string, exchange: string, symbol: string, side: string, income_at: number) {
    this.id = id;
    this.exchange = exchange;
    this.symbol = symbol;
    this.side = side;
    this.income_at = income_at;
  }
}
