const Candlestick = require('../../dict/candlestick');

module.exports = class ExchangeCandleCombine {
  constructor(candlestickRepository) {
    this.candlestickRepository = candlestickRepository;
  }

  async fetchCombinedCandles(mainExchange, symbol, period, exchanges = [], olderThen = undefined) {
    return this.combinedCandles(
      this.candlestickRepository.getLookbacksForPair(mainExchange, symbol, period, 750, olderThen),
      mainExchange,
      symbol,
      period,
      exchanges
    );
  }

  async fetchCombinedCandlesSince(mainExchange, symbol, period, exchanges = [], start) {
    return this.combinedCandles(
      this.candlestickRepository.getLookbacksSince(mainExchange, symbol, period, start),
      mainExchange,
      symbol,
      period,
      exchanges
    );
  }

  async fetchCandlePeriods(mainExchange, symbol) {
    return this.candlestickRepository.getCandlePeriods(mainExchange, symbol);
  }

  async combinedCandles(candlesAwait, mainExchange, symbol, period, exchanges = []) {
    const currentTime = Math.round(new Date().getTime() / 1000);

    // we filter the current candle, be to able to use it later
    const candles = (await candlesAwait).filter(c => c.time <= currentTime);

    const result = {
      [mainExchange]: candles
    };

    // no need for overhead
    if (exchanges.length === 0 || candles.length === 0) {
      return result;
    }

    const c = {
      [mainExchange]: {}
    };

    candles.forEach(candle => {
      c[mainExchange][candle.time] = candle;
    });

    const start = candles[candles.length - 1].time;

    await Promise.all(
      exchanges.map(exchange => {
        return new Promise(async resolve => {
          const candles = {};

          const databaseCandles = await this.candlestickRepository.getLookbacksSince(
            exchange.name,
            exchange.symbol,
            period,
            start
          );
          databaseCandles.forEach(c => {
            candles[c.time] = c;
          });

          const myCandles = [];

          let timeMatchedOnce = false;
          for (const time of Object.keys(c[mainExchange])) {
            // time was matched
            if (candles[time]) {
              myCandles.push(candles[time]);
              timeMatchedOnce = true;
              continue;
            }

            // pipe the close prices from last known candle
            const previousCandle = myCandles[myCandles.length - 1];

            const candle = previousCandle
              ? new Candlestick(
                  parseInt(time),
                  previousCandle.close,
                  previousCandle.close,
                  previousCandle.close,
                  previousCandle.close,
                  0
                )
              : new Candlestick(parseInt(time));

            myCandles.push(candle);
          }

          if (timeMatchedOnce) {
            result[exchange.name + exchange.symbol] = myCandles.reverse();
          }

          resolve();
        });
      })
    );

    return result;
  }
};
