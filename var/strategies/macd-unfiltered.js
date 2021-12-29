const SignalResult = require('../../src/modules/strategy/dict/signal_result.js');

module.exports = class Macd {
  getName() {
    return 'macd unfiltered';
  }

  buildIndicator(indicatorBuilder, options) {
    if (!options.period) {
      throw Error('Invalid period');
    }

    indicatorBuilder.add('macd', 'macd_ext', options.period, options);

    indicatorBuilder.add('hma', 'hma', options.period, {
      length: 9
    });

    indicatorBuilder.add('sma200', 'sma', options.period, {
      length: 200
    });
  }

  period(indicatorPeriod) {
    const sma200Full = indicatorPeriod.getIndicator('sma200');
    const macdFull = indicatorPeriod.getIndicator('macd');
    const hmaFull = indicatorPeriod.getIndicator('hma');

    if (!macdFull || !sma200Full || !hmaFull || macdFull.length < 2 || sma200Full.length < 2) {
      return undefined;
    }

    const hma = hmaFull.slice(-1)[0];
    const sma200 = sma200Full.slice(-1)[0];
    const macd = macdFull.slice(-2);

    // overall trend filter
    const long = hma >= sma200;

    const lastSignal = indicatorPeriod.getLastSignal();

    const current = macd[0].histogram;
    const before = macd[1].histogram;

    const debug = {
      sma200: sma200[0],
      histogram: macd[0].histogram,
      last_signal: lastSignal,
      before: before,
      current: current,
      long: long
    };

    // trend change
    if ((lastSignal === 'long' && before > 0 && current < 0) || (lastSignal === 'short' && before < 0 && current > 0)) {
      return SignalResult.createSignal('reverse', debug);
    }

    if (before < 0 && current > 0) {
      return SignalResult.createSignal('long', debug);
    }

    if (before > 0 && current < 0) {
      return SignalResult.createSignal('short', debug);
    }

    // if (indicatorPeriod.getProfit() < -1.5) {
    //   // stop loss
    //   const signalResult = SignalResult.createSignal('close', debug);
    //   signalResult.addDebug('message', 'SL');
    //   return signalResult;
    // }
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
      period: '15m',
      default_ma_type: 'MA',
      fast_period: 12,
      slow_period: 26,
      signal_period: 9
    };
  }
};
