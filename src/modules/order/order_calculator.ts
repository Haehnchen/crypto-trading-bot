import { Tickers } from '../../storage/tickers';
import { PairConfig } from '../pairs/pair_config';
import { OrderCapital } from '../../dict/order_capital';
import type { Logger } from '../services';
import type { ExchangeManager } from '../exchange/exchange_manager';

export class OrderCalculator {
  private tickers: Tickers;
  private logger: Logger;
  private exchangeManager: ExchangeManager;
  private pairConfig: PairConfig;

  /**
   * @param tickers {Tickers}
   * @param logger {Logger}
   * @param exchangeManager {ExchangeManager}
   * @param pairConfig {PairConfig}
   */
  constructor(tickers: Tickers, logger: Logger, exchangeManager: ExchangeManager, pairConfig: PairConfig) {
    this.tickers = tickers;
    this.logger = logger;
    this.exchangeManager = exchangeManager;
    this.pairConfig = pairConfig;
  }

  /**
   * @param exchangeName String
   * @param symbol String
   * @param capital {OrderCapital}
   * @returns {Promise<?Number>}
   */
  async calculateOrderSizeCapital(exchangeName: string, symbol: string, capital: OrderCapital): Promise<number | undefined> {
    const balancePercent = capital.getBalance();
    const exchange = this.exchangeManager.get(exchangeName);

    let amountAsset = capital.getAsset();
    let amountCurrency = balancePercent && exchange.getTradableBalance ? (exchange.getTradableBalance() * balancePercent) / 100 : capital.getCurrency();

    if (!amountAsset && !amountCurrency) {
      throw new Error(`Invalid capital`);
    }
    if (!amountAsset) {
      amountAsset = await this.convertCurrencyToAsset(exchangeName, symbol, amountCurrency!);
    }
    if (!amountCurrency) {
      amountCurrency = await this.convertAssetToCurrency(exchangeName, symbol, amountAsset!);
    }
    return exchange.calculateAmount(exchange.isInverseSymbol(symbol) ? amountCurrency! : amountAsset!, symbol);
  }

  async calculateOrderSize(exchangeName: string, symbol: string): Promise<number | undefined> {
    const capital = this.pairConfig.getSymbolCapital(exchangeName, symbol);
    if (!capital) {
      this.logger.error(`No capital: ${JSON.stringify([exchangeName, symbol, capital])}`);
      return undefined;
    }

    return this.calculateOrderSizeCapital(exchangeName, symbol, capital);
  }

  /**
   * If you want to trade with 0.25 BTC this calculated the asset amount which are available to buy
   *
   * @param exchangeName
   * @param symbol
   * @param currencyAmount
   * @returns {Promise<number>}
   */
  async convertCurrencyToAsset(exchangeName: string, symbol: string, currencyAmount: number): Promise<number | undefined> {
    const ticker = this.tickers.get(exchangeName, symbol);
    if (!ticker || !ticker.bid) {
      this.logger.error(`Invalid ticker for calculate currency capital:${JSON.stringify([exchangeName, symbol, currencyAmount])}`);
      return undefined;
    }

    return currencyAmount / ticker.bid;
  }

  /**
   * If you want to trade with 0.25 BTC this calculated the asset amount which are available to buy
   *
   * @param exchangeName
   * @param symbol
   * @param currencyAmount
   * @returns {Promise<number>}
   */
  async convertAssetToCurrency(exchangeName: string, symbol: string, currencyAmount: number): Promise<number | undefined> {
    const ticker = this.tickers.get(exchangeName, symbol);
    if (!ticker || !ticker.bid) {
      this.logger.error(`Invalid ticker for calculate currency capital:${JSON.stringify([exchangeName, symbol, currencyAmount])}`);
      return undefined;
    }

    return ticker.bid * currencyAmount;
  }
}
