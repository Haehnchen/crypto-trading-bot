module.exports = class CandleExportHttp {
  constructor(candlestickRepository) {
    this.candlestickRepository = candlestickRepository;
  }

  async getCandles(exchange, symbol, period, start, end) {
    return this.candlestickRepository.getCandlesInWindow(
      exchange,
      symbol,
      period,
      start.getTime() / 1000,
      end.getTime() / 1000
    );
  }

  async getPairs() {
    return this.candlestickRepository.getExchangePairs();
  }
};
