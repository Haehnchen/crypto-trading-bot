const SignalResult = require('../../src/modules/strategy/dict/signal_result.js');

module.exports = class Dema {
  getName() {
    return 'EMA Cross';
  }

  buildIndicator(indicatorBuilder, options) {
    if (!options.period) {
      throw Error('Invalid period');
    }

    indicatorBuilder.add('fastEma', 'ema', options.period, {
      length: options.fast_ema
    });
    indicatorBuilder.add('slowEma', 'ema', options.period, {
      length: options.slow_ema
    });
  }

  period(indicatorPeriod) {
    const fastEma = indicatorPeriod.getLatestIndicator('fastEma');
    const slowEma = indicatorPeriod.getLatestIndicator('slowEma');
    const lastSignal = indicatorPeriod.getLastSignal();

    const debug = {
      fast_ema: fastEma,
      slow_ema: slowEma,
      last_signal: lastSignal
    };

    const signal = SignalResult.createEmptySignal(debug);
    // trend change
    if (slowEma > fastEma) {
      if (lastSignal === 'short') {
        signal.setSignal('close');
      } else if (lastSignal === 'close') {
        signal.setSignal('long');
      } else {
        signal.setSignal('long');
      }
    } else if (slowEma <= fastEma) {
      if (lastSignal === 'long') {
        signal.setSignal('close');
      } else if (lastSignal === 'close') {
        signal.setSignal('short');
      } else {
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
      fast_ema: 40,
      slow_ema: 200
    };
  }
};
