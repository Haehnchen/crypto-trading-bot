module.exports = class OrderCapital {
  static get ASSET() {
    return 'asset';
  }

  static get CURRENCY() {
    return 'currency';
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

  getAmount() {
    if (this.type === OrderCapital.CURRENCY) {
      return this.currency;
    }

    if (this.type === OrderCapital.ASSET) {
      return this.asset;
    }

    throw new Error(`Invalid capital type:${this.type}`);
  }

  getAsset() {
    return this.asset;
  }

  getCurrency() {
    return this.currency;
  }
};
