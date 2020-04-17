const SignalResult = require('../dict/signal_result');

module.exports = class AwesomeOscillatorCrossZero {
  getName() {
    return 'awesome_oscillator_cross_zero';
  }

  buildIndicator(indicatorBuilder, options) {
    if (!options.period) {
      throw 'Invalid period';
    }

    indicatorBuilder.add('ao', 'ao', options.period, options);

    indicatorBuilder.add('sma200', 'sma', options.period, {
      length: 200
    });
  }

  period(indicatorPeriod) {
    return this.macd(
      indicatorPeriod.getPrice(),
      indicatorPeriod.getIndicator('sma200'),
      indicatorPeriod.getIndicator('ao'),
      indicatorPeriod.getLastSignal()
    );
  }

  macd(price, sma200Full, aoFull, lastSignal) {
    if (aoFull.length <= 2 || sma200Full.length < 2) {
      return;
    }

    // remove incomplete candle
    const sma200 = sma200Full.slice(0, -1);
    const ao = aoFull.slice(0, -1);

    const debug = {
      sma200: sma200.slice(-1)[0],
      ao: ao.slice(-1)[0],
      last_signal: lastSignal
    };

    const before = ao.slice(-2)[0];
    const last = ao.slice(-1)[0];

    // trend change
    if ((lastSignal === 'long' && before > 0 && last < 0) || (lastSignal === 'short' && before < 0 && last > 0)) {
      return SignalResult.createSignal('close', debug);
    }

    // sma long
    const long = price >= sma200.slice(-1)[0];

    if (long) {
      // long
      if (before < 0 && last > 0) {
        return SignalResult.createSignal('long', debug);
      }
    } else {
      // short

      if (before > 0 && last < 0) {
        return SignalResult.createSignal('short', debug);
      }
    }

    return SignalResult.createEmptySignal(debug);
  }

  getOptions() {
    return {
      period: '15m'
    };
  }
};
