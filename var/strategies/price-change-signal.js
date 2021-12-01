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
    const lastCandle = indicatorPeriod.getLatestIndicator('candles');
    const compareCandleIndex =
      options.compareCandle > allCandles.length ? 0 : allCandles.length - options.compareCandle - 1;
    const compareCandle = allCandles[compareCandleIndex];

    const debug = {
      lastCandle: lastCandle,
      compareCandle: compareCandle,
      compareCandleIndex: compareCandleIndex
    };

    const pricePercentage = lastCandle.close * options.thresholdPercentage;
    const signal = SignalResult.createEmptySignal(debug);

    if (compareCandle !== undefined) {
      if (compareCandle.close * 1 + pricePercentage <= lastCandle.high) {
        signal.setSignal('long');
      } else if (compareCandle.close * 1 - compareCandle.close >= lastCandle.low) {
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
      period: '1m',
      compareCandle: 60,
      thresholdPercentage: 0.05
    };
  }
};
