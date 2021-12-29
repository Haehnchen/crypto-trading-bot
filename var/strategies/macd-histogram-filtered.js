const SignalResult = require('../../src/modules/strategy/dict/signal_result.js');

const macdBullPeaks = [];
const macdBearPeaks = [];
let highestProfit = 0;

let macdPeak = 0;

module.exports = class Macd {
  getName() {
    return 'Macd filtered';
  }

  buildIndicator(indicatorBuilder, options) {
    if (!options.period) {
      throw Error('Invalid period');
    }

    indicatorBuilder.add('macd', 'macd_ext', options.period, options);

    indicatorBuilder.add('emaFast', 'ema', options.period_filter, {
      length: 40
    });

    indicatorBuilder.add('emaSlow', 'ema', options.period_filter, {
      length: 10
    });

    indicatorBuilder.add('psar', 'psar', options.period, {
      step: 0.02,
      max: 0.02
    });
  }

  period(indicatorPeriod, options) {
    const emaSlowFull = indicatorPeriod.getIndicator('emaSlow');
    const macdFull = indicatorPeriod.getIndicator('macd');
    const emaFastFull = indicatorPeriod.getIndicator('emaFast');
    const psarFull = indicatorPeriod.getIndicator('psar');

    if (!macdFull || !emaSlowFull || !emaFastFull || !psarFull || macdFull.length < 2 || emaSlowFull.length < 2) {
      return undefined;
    }

    const emaFast = emaFastFull.slice(-1)[0];
    const emaSlow = emaSlowFull.slice(-1)[0];
    const macd = macdFull.slice(-2);
    const psar = psarFull.slice(-1)[0];

    // overall trend filter
    const long = emaFast >= emaSlow;

    const lastSignal = indicatorPeriod.getLastSignal();

    const debug = {
      emaSlow: emaSlow,
      emaFast: emaFast,
      psar: psar,
      histogram: macd[0].histogram,
      last_signal: lastSignal,
      long: long
    };

    const current = macd[0].histogram;
    const before = macd[1].histogram;

    if (lastSignal === undefined) {
      if (long) {
        if (current > macdPeak) {
          macdPeak = current;
        }

        if (
          macdBullPeaks.length > 2 &&
          macdPeak > this.median(macdBullPeaks) &&
          macdPeak * options.histogram_threshold > current
        ) {
          // long {if (before < 0 && current > 0) {
          this.addBullMacd(macdPeak);
          macdPeak = 0;
          return SignalResult.createSignal('long', debug);
        }

        if (before < 0 && current > 0) {
          this.addBullMacd(macdPeak);
          macdPeak = 0;
          return SignalResult.createEmptySignal(debug);
        }
      } else {
        // short

        if (current < macdPeak) {
          macdPeak = current;
        }

        if (
          macdBearPeaks.length > 2 &&
          macdPeak < this.median(macdBearPeaks) &&
          macdPeak * options.histogram_threshold < current
        ) {
          this.addBearMacd(macdPeak);
          macdPeak = 0;
          return SignalResult.createSignal('short', debug);
        }

        if (before > 0 && current < 0) {
          this.addBearMacd(macdPeak);
          macdPeak = 0;
          return SignalResult.createEmptySignal(debug);
        }
      }
    }

    if (indicatorPeriod.getLastSignal()) {
      if (psarFull.length > 0) {
        if (indicatorPeriod.getLastSignal() === 'short' && psar > indicatorPeriod.getPrice()) {
          const signalResult = SignalResult.createSignal('close', debug);
          // take profit
          signalResult.addDebug('message', 'PSAR cross');
          return signalResult;
        }

        if (indicatorPeriod.getLastSignal() === 'long' && psar < indicatorPeriod.getPrice()) {
          const signalResult = SignalResult.createSignal('close', debug);
          // take profit
          signalResult.addDebug('message', 'PSAR cross');
          return signalResult;
        }
      }

      // if (indicatorPeriod.getProfit() - highestProfit > 0) {
      //   highestProfit = indicatorPeriod.getProfit();
      // } else if (highestProfit - indicatorPeriod.getProfit() > options.take_profit) {
      //   highestProfit = 0;
      //   const signalResult = SignalResult.createSignal('close', debug);
      //   // take profit
      //   signalResult.addDebug('message', 'TP');
      //   return signalResult;
      // } else

      if (indicatorPeriod.getProfit() < -options.stop_loss) {
        // stop loss
        const signalResult = SignalResult.createSignal('close', debug);
        signalResult.addDebug('message', 'SL');
        return signalResult;
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

          return row.long === true ? 'up' : 'down';
        },
        type: 'arrow'
      },
      {
        label: 'histogram',
        value: 'histogram',
        type: 'histogram'
      }
    ];
  }

  median(values) {
    if (values.length === 0) return 0;

    values.sort(function(a, b) {
      return a - b;
    });

    const half = Math.floor(values.length / 2);

    if (values.length % 2) {
      return values[half];
    }

    return (values[half - 1] + values[half]) / 2.0;
  }

  addBullMacd(value) {
    if (macdBullPeaks.length === 51) {
      macdBullPeaks.shift();
    }

    macdBullPeaks.push(value);
  }

  addBearMacd(value) {
    if (macdBearPeaks.length === 51) {
      macdBearPeaks.shift();
    }

    macdBearPeaks.push(value);
  }

  getOptions() {
    return {
      period: '5m',
      period_filter: '1h',
      default_ma_type: 'EMA',
      fast_period: 30,
      slow_period: 100,
      take_profit: 1,
      stop_loss: 0.4,
      histogram_threshold: 0.2
    };
  }
};
