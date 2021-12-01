const SignalResult = require('../../src/modules/strategy/dict/signal_result.js');

module.exports = class Dema {
  getName() {
    return 'Price changed';
  }

  buildIndicator(indicatorBuilder, options) {
    if (!options.period) {
      throw Error('Invalid period');
    }

    indicatorBuilder.add('sma200', 'sma', options.period, {
      length: 200
    });
  }

  period(indicatorPeriod, options) {
    const allCandles = indicatorPeriod.getIndicator('candles');
    const lastCandle = allCandles[allCandles.length - 1];
    const penultimateCandle = allCandles[allCandles.length - 2];

    const debug = {
      lastCandle: lastCandle,
      penultimateCandle: penultimateCandle
    };

    const pricePercentage = lastCandle.close * options.thresholdPercentage;
    const signal = SignalResult.createEmptySignal(debug);

    if (penultimateCandle !== undefined) {
      if (penultimateCandle.close * 1 + pricePercentage <= lastCandle.high) {
        signal.setSignal('long');
      } else if (penultimateCandle.close * 1 - penultimateCandle.close >= lastCandle.low) {
        signal.setSignal('short');
      }
    }

    return signal;
  }

  getBacktestColumns() {
    return [];
  }

  getOptions() {
    return {
      period: '1h',
      thresholdPercentage: 0.05
    };
  }
};
