const SignalResult = require('../../src/modules/strategy/dict/signal_result.js');

let bullMarket;
let highestProfit = 0;

module.exports = class Dema {
  getName() {
    return 'EMA Cross Strategy';
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

    indicatorBuilder.add('hma', 'hma', options.period, {
      length: 9
    });

    indicatorBuilder.add('hma', 'hma', options.period, {
      length: 100
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
      bullMarket = true;
      if (lastSignal === undefined) {
        signal.setSignal('long');
        // } else if (lastSignal === 'short') {
        //   signal.setSignal('close');
      }
    } else if (slowEma <= fastEma) {
      bullMarket = false;
      if (lastSignal === undefined) {
        signal.setSignal('short');
        // } else if (lastSignal === 'long') {
        //   signal.setSignal('close');
      }
    }

    if (indicatorPeriod.getLastSignal()) {
      if (indicatorPeriod.getProfit() - highestProfit > 0) {
        highestProfit = indicatorPeriod.getProfit();
      } else if (highestProfit - indicatorPeriod.getProfit() > 3) {
        highestProfit = 0;
        // take profit
        signal.addDebug('message', 'TP');
        signal.setSignal('close');
      } else if (indicatorPeriod.getProfit() < -3.5) {
        // stop loss
        signal.addDebug('message', 'SL');
        // signal.setSignal('close');
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
      fast_ema: 14,
      slow_ema: 200
    };
  }
};
