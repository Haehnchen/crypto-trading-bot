module.exports = class Position {
  /**
   * @param symbol 'BTCUSD'
   * @param side "long" or "short"
   * @param amount negative for short and positive for long entries
   * @param profit Current profit in percent: "23.56"
   * @param updatedAt Item last found or sync
   * @param entry The entry price
   * @param createdAt
   */
  constructor(symbol, side, amount, profit, updatedAt, entry, createdAt) {
    if (!['long', 'short'].includes(side)) {
      throw `Invalid position direction given:${side}`;
    }

    if (amount < 0 && side === 'long') {
      throw `Invalid direction amount:${side}`;
    }

    if (amount > 0 && side === 'short') {
      throw `Invalid direction amount:${side}`;
    }

    this.symbol = symbol;
    this.side = side;
    this.amount = amount;
    this.profit = profit;
    this.updatedAt = updatedAt;
    this.entry = entry;
    this.createdAt = createdAt;
  }

  static createProfitUpdate(position, profit) {
    return new Position(
      position.symbol,
      position.side,
      position.amount,
      profit,
      position.updatedAt,
      position.entry,
      position.createdAt
    );
  }
};
