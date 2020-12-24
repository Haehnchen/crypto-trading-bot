module.exports = class Position {
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
  constructor(symbol, side, amount, profit, updatedAt, entry, createdAt, raw = undefined) {
    if (!['long', 'short'].includes(side)) {
      throw new Error(`Invalid position direction given:${side}`);
    }

    if (amount < 0 && side === 'long') {
      throw new Error(`Invalid direction amount:${side}`);
    }

    if (amount > 0 && side === 'short') {
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

  getSide() {
    return this.side;
  }

  isShort() {
    return this.side === 'short';
  }

  isLong() {
    return this.side === 'long';
  }

  getAmount() {
    return this.amount;
  }

  getSymbol() {
    return this.symbol;
  }

  getProfit() {
    return this.profit;
  }

  getEntry() {
    return this.entry;
  }

  getCreatedAt() {
    return this.createdAt;
  }

  getUpdatedAt() {
    return this.updatedAt;
  }

  /**
   * For position based exchanges
   *
   * @returns {array}
   */
  getRaw() {
    return this.raw;
  }

  static create(symbol, amount, updatedAt, createdAt, entry, profit, raw = undefined) {
    return new Position(symbol, amount < 0 ? 'short' : 'long', amount, profit, updatedAt, entry, createdAt, raw);
  }

  static createProfitUpdate(position, profit) {
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
};
