module.exports = class CandleExportHttp {
  constructor(candlestickRepository, pairConfig) {
    this.candlestickRepository = candlestickRepository;
    this.pairConfig = pairConfig;
  }

  async getCandles(exchange, symbol, period, start, end) {
    return this.candlestickRepository.getCandlesInWindow(exchange, symbol, period, start, end);
  }

  async getPairs() {
    return this.pairConfig.getAllPairNames().map(p => {
      const split = p.split('.');

      return {
        exchange: split[0],
        symbol: split[1]
      };
    });
  }
};
