module.exports = class OrderCapital {
  static get ASSET() {
    return 'asset';
  }

  static get CURRENCY() {
    return 'currency';
  }

  static get BALANCE() {
    return 'balance';
  }

  static createAsset(asset) {
    const capital = new OrderCapital();
    capital.type = OrderCapital.ASSET;
    capital.asset = asset;
    return capital;
  }

  static createCurrency(currency) {
    const capital = new OrderCapital();
    capital.type = OrderCapital.CURRENCY;
    capital.currency = currency;
    return capital;
  }

  static createBalance(balance) {
    const capital = new OrderCapital();
    capital.type = OrderCapital.BALANCE;
    capital.balance = balance;
    return capital;
  }

  getAmount() {
    if (this.type === OrderCapital.CURRENCY) {
      return this.getCurrency();
    }

    if (this.type === OrderCapital.ASSET) {
      return this.getAsset();
    }

    if (this.type === OrderCapital.BALANCE) {
      return this.getBalance();
    }

    throw new Error(`Invalid capital type:${this.type}`);
  }

  getAsset() {
    return this.asset;
  }

  getCurrency() {
    return this.currency;
  }

  getBalance() {
    return this.balance;
  }
};
