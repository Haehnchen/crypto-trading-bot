import _ from 'lodash';
import { OrderCapital } from '../../dict/order_capital';

export interface SymbolInstance {
  exchange: string;
  symbol: string;
  trade?: {
    capital?: number;
    currency_capital?: number;
    balance_percent?: number;
  };
}

export interface InstancesConfig {
  symbols: SymbolInstance[];
}

export class PairConfig {
  private instances: InstancesConfig;

  constructor(instances: InstancesConfig) {
    this.instances = instances;
  }

  /**
   * @param exchangeName string
   * @param symbol string
   * @returns OrderCapital
   */
  getSymbolCapital(exchangeName: string, symbol: string): OrderCapital | undefined {
    const capital = this.instances.symbols.find(
      instance =>
        instance.exchange === exchangeName && instance.symbol === symbol && _.get(instance, 'trade.capital', 0) > 0
    );

    if (capital) {
      return OrderCapital.createAsset(capital.trade.capital!);
    }

    const capitalCurrency = this.instances.symbols.find(
      instance =>
        instance.exchange === exchangeName &&
        instance.symbol === symbol &&
        _.get(instance, 'trade.currency_capital', 0) > 0
    );

    if (capitalCurrency) {
      return OrderCapital.createCurrency(capitalCurrency.trade.currency_capital!);
    }

    const balancePercent = this.instances.symbols.find(
      instance =>
        instance.exchange === exchangeName &&
        instance.symbol === symbol &&
        _.get(instance, 'trade.balance_percent', 0) > 0
    );

    if (balancePercent) {
      return OrderCapital.createBalance(balancePercent.trade.balance_percent!);
    }

    return undefined;
  }

  /**
   * Get all instance pairs sorted
   *
   * @returns string[]
   */
  getAllPairNames(): string[] {
    const pairs: string[] = [];

    this.instances.symbols.forEach(symbol => {
      pairs.push(`${symbol.exchange}.${symbol.symbol}`);
    });

    return pairs.sort();
  }
}
