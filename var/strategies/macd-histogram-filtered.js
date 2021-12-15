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

    indicatorBuilder.add('ema40', 'ema', options.period_filter, {
      length: 40
    });

    indicatorBuilder.add('ema200', 'ema', options.period_filter, {
      length: 100
    });
  }

  period(indicatorPeriod, options) {
    const ema200Full = indicatorPeriod.getIndicator('ema200');
    const macdFull = indicatorPeriod.getIndicator('macd');
    const ema40Full = indicatorPeriod.getIndicator('ema40');

    if (!macdFull || !ema200Full || !ema40Full || macdFull.length < 2 || ema200Full.length < 2) {
      return undefined;
    }

    const ema40 = ema40Full.slice(-1)[0];
    const ema200 = ema200Full.slice(-1)[0];
    const macd = macdFull.slice(-2);

    // overall trend filter
    const long = ema40 >= ema200;

    const lastSignal = indicatorPeriod.getLastSignal();

    const debug = {
      ema200: ema200[0],
      histogram: macd[0].histogram,
      last_signal: lastSignal,
      long: long
    };

    const current = macd[0].histogram;
    const before = macd[1].histogram;

    // // trend change
    // if ((lastSignal === 'long' && before > 0 && current < 0) || (lastSignal === 'short' && before < 0 && current > 0)) {
    //   macdPeak = 0;
    //   return SignalResult.createSignal('close', debug);
    // }
    if (lastSignal === undefined) {
      if (long) {
        if (current > macdPeak) {
          macdPeak = current;
        }

        if (
          macdBullPeaks.length > 5 &&
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
          macdBearPeaks.length > 5 &&
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
      if (indicatorPeriod.getProfit() - highestProfit > 0) {
        highestProfit = indicatorPeriod.getProfit();
      } else if (highestProfit - indicatorPeriod.getProfit() > options.take_profit) {
        highestProfit = 0;
        const signalResult = SignalResult.createSignal('close', debug);
        // take profit
        signalResult.addDebug('message', 'TP');
        return signalResult;
      } else if (indicatorPeriod.getProfit() < -options.stop_loss) {
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
      period: '1m',
      period_filter: '15m',
      default_ma_type: 'EMA',
      fast_period: 60,
      slow_period: 130,
      signal_period: 45,
      take_profit: 1,
      stop_loss: 0.4,
      histogram_threshold: 0.2
    };
  }

  median(values) {
    if (values.length === 0) throw new Error('No inputs');

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
};
