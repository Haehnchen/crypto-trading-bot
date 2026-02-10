export type PositionSide = 'long' | 'short';

export class Position {
  static readonly SIDE_LONG: PositionSide = 'long';
  static readonly SIDE_SHORT: PositionSide = 'short';

  symbol: string;
  side: PositionSide;
  amount: number;
  profit: number;
  updatedAt: Date;
  entry: number;
  createdAt: Date;
  raw?: any;

  /**
   * @param symbol 'BTCUSD'
   * @param side "long" or "short"
   * @param amount negative for short and positive for long entries
   * @param profit Current profit in percent: "23.56"
   * @param updatedAt Item last found or sync
   * @param entry The entry price
   * @param createdAt
   * @param raw
   */
  constructor(symbol: string, side: PositionSide, amount: number, profit: number, updatedAt: Date, entry: number, createdAt: Date, raw?: any) {
    if (![Position.SIDE_LONG, Position.SIDE_SHORT].includes(side)) {
      throw new Error(`Invalid position direction given:${side}`);
    }

    if (amount < 0 && side === Position.SIDE_LONG) {
      throw new Error(`Invalid direction amount:${side}`);
    }

    if (amount > 0 && side === Position.SIDE_SHORT) {
      throw new Error(`Invalid direction amount:${side}`);
    }

    this.symbol = symbol;
    this.side = side;
    this.amount = amount;
    this.profit = profit;
    this.updatedAt = updatedAt;
    this.entry = entry;
    this.createdAt = createdAt;
    this.raw = raw;
  }

  getSide(): PositionSide {
    return this.side;
  }

  isShort(): boolean {
    return this.getSide() === Position.SIDE_SHORT;
  }

  isLong(): boolean {
    return this.getSide() === Position.SIDE_LONG;
  }

  getAmount(): number {
    return this.amount;
  }

  getSymbol(): string {
    return this.symbol;
  }

  getProfit(): number {
    return this.profit;
  }

  getEntry(): number {
    return this.entry;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getUpdatedAt(): Date {
    return this.updatedAt;
  }

  /**
   * For position based exchanges
   */
  getRaw(): any {
    return this.raw;
  }

  static create(symbol: string, amount: number, updatedAt: Date, createdAt: Date, entry: number, profit: number, raw?: any): Position {
    return new Position(symbol, amount < 0 ? 'short' : 'long', amount, profit, updatedAt, entry, createdAt, raw);
  }

  static createProfitUpdate(position: Position, profit: number): Position {
    return new Position(
      position.symbol,
      position.side,
      position.amount,
      profit,
      position.updatedAt,
      position.entry,
      position.createdAt,
      position.raw
    );
  }
}
