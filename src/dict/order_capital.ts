export type OrderCapitalType = 'asset' | 'currency' | 'balance';

export class OrderCapital {
  static readonly ASSET: OrderCapitalType = 'asset';
  static readonly CURRENCY: OrderCapitalType = 'currency';
  static readonly BALANCE: OrderCapitalType = 'balance';

  type?: OrderCapitalType;
  asset?: number;
  currency?: number;
  balance?: number;

  static createAsset(asset: number): OrderCapital {
    const capital = new OrderCapital();
    capital.type = OrderCapital.ASSET;
    capital.asset = asset;
    return capital;
  }

  static createCurrency(currency: number): OrderCapital {
    const capital = new OrderCapital();
    capital.type = OrderCapital.CURRENCY;
    capital.currency = currency;
    return capital;
  }

  static createBalance(balance: number): OrderCapital {
    const capital = new OrderCapital();
    capital.type = OrderCapital.BALANCE;
    capital.balance = balance;
    return capital;
  }

  getAmount(): number {
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

  getAsset(): number {
    return this.asset!;
  }

  getCurrency(): number {
    return this.currency!;
  }

  getBalance(): number {
    return this.balance!;
  }
}
