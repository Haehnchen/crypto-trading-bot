module.exports = class OrderCalculator {
  /**
   * @param tickers {Tickers}
   * @param logger {Logger}
   * @param exchangeManager {ExchangeManager}
   * @param pairConfig {PairConfig}
   */
  constructor(tickers, logger, exchangeManager, pairConfig) {
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
  async calculateOrderSizeCapital(exchangeName, symbol, capital) {
    const balancePercent = capital.getBalance();
    const exchange = this.exchangeManager.get(exchangeName);

    let amountAsset = capital.getAsset();
    let amountCurrency = balancePercent
      ? (exchange.getTradableBalance() * balancePercent) / 100
      : capital.getCurrency();

    if (!amountAsset && !amountCurrency) {
      throw new Error(`Invalid capital`);
    }
    if (!amountAsset) {
      amountAsset = await this.convertCurrencyToAsset(exchangeName, symbol, amountCurrency);
    }
    if (!amountCurrency) {
      amountCurrency = await this.convertAssetToCurrency(exchangeName, symbol, amountAsset);
    }
    return exchange.calculateAmount(exchange.isInverseSymbol(symbol) ? amountCurrency : amountAsset, symbol);
  }

  async calculateOrderSize(exchangeName, symbol) {
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
  async convertCurrencyToAsset(exchangeName, symbol, currencyAmount) {
    const ticker = this.tickers.get(exchangeName, symbol);
    if (!ticker || !ticker.bid) {
      this.logger.error(
        `Invalid ticker for calculate currency capital:${JSON.stringify([exchangeName, symbol, currencyAmount])}`
      );
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
  async convertAssetToCurrency(exchangeName, symbol, currencyAmount) {
    const ticker = this.tickers.get(exchangeName, symbol);
    if (!ticker || !ticker.bid) {
      this.logger.error(
        `Invalid ticker for calculate currency capital:${JSON.stringify([exchangeName, symbol, currencyAmount])}`
      );
      return undefined;
    }

    return ticker.bid * currencyAmount;
  }
};
