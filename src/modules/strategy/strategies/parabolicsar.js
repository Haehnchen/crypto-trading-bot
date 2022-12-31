const SignalResult = require('../dict/signal_result');

module.exports = class PARABOL {
  getName() {
    return 'parabol';
  }

  buildIndicator(indicatorBuilder, options) {
    if (!options.period) {
      throw Error('Invalid period');
    }

    indicatorBuilder.add('psar', 'PSAR', options.period, options);
  }

  period(indicatorPeriod) {
    const psar = indicatorPeriod.getIndicator('psar');
    const psarVal = psar.result;
    const price = indicatorPeriod.getPrice();
    const diff = price - psarVal;

    const lastSignal = indicatorPeriod.getLastSignal();

    const long = diff > 0;

    const debug = {
      psar: psar[0],
      histogram: psar[0].histogram,
      last_signal: lastSignal,
      long: long
    };

    const current = psar[0].histogram;
    const before = psar[1].histogram;

    // trend change
    if ((lastSignal === 'long' && before > 0 && current < 0) || (lastSignal === 'short' && before < 0 && current > 0)) {
      return SignalResult.createSignal('close', debug);
    }

    if (long) {
      // long
      if (before < 0 && current > 0) {
        return SignalResult.createSignal('long', debug);
      }
    } else {
      // short

      if (before > 0 && current < 0) {
        return SignalResult.createSignal('short', debug);
      }
    }

    return SignalResult.createEmptySignal(debug);
  }

  getBacktestColumns() {
    return [
      {
        label: 'trend',
        value: row => {
          if (typeof row.long !== 'boolean') {
            return undefined;
          }

          return row.long === true ? 'success' : 'danger';
        },
        type: 'icon'
      },
      {
        label: 'histogram',
        value: 'histogram',
        type: 'histogram'
      }
    ];
  }

  getOptions() {
    return {
      period: '15m'
    };
  }
};
