const SignalResult = require('../dict/signal_result');

module.exports = class PivotReversalStrategy {
  getName() {
    return 'pivot_reversal_strategy';
  }

  buildIndicator(indicatorBuilder, options) {
    indicatorBuilder.add('candles_1m', 'candles', '1m');
    indicatorBuilder.add('pivot_points', 'pivot_points_high_low', '15m', {
      left: options.left || 4,
      right: options.right || 2
    });

    indicatorBuilder.add('sma200', 'sma', '1h', {
      length: 200
    });

    indicatorBuilder.add('sma50', 'sma', '1h', {
      length: 50
    });
  }

  async period(indicatorPeriod) {
    let debug;
    const currentValues = (debug = indicatorPeriod.getLatestIndicators());
    if (!currentValues.sma200 || currentValues.sma200.length < 10) {
      return;
    }

    const candles1m = indicatorPeriod.getIndicator('candles_1m');
    if (candles1m) {
      debug.candles = candles1m
        .slice(-3)
        .map(c => c.close)
        .join(', ');
    }

    // close; use watchdog!
    const lastSignal = indicatorPeriod.getLastSignal();
    if (lastSignal) {
      return SignalResult.createEmptySignal(debug);

      if (lastSignal === 'long' && !this.getPivotSignal(false, indicatorPeriod)) {
        return SignalResult.createSignal('close', debug);
      }

      if (lastSignal === 'short' && !this.getPivotSignal(true, indicatorPeriod)) {
        return SignalResult.createSignal('close', debug);
      }

      return SignalResult.createEmptySignal(debug);
    }

    const long = indicatorPeriod.getPrice() > currentValues.sma200;

    const signal = this.getPivotSignal(long, indicatorPeriod);
    if (signal) {
      return SignalResult.createSignal(signal, debug);
    }

    return SignalResult.createEmptySignal(debug);
  }

  getPivotSignal(long, indicatorPeriod) {
    for (const value of indicatorPeriod.visitLatestIndicators(3)) {
      if (!long && value.pivot_points && value.pivot_points.low && value.pivot_points.low.low) {
        const candles1m = indicatorPeriod.getIndicator('candles_1m');
        const mins = candles1m.slice(-7);

        const closes =
          mins
            .map(c => c.close)
            .reduce((acc, val) => {
              return acc + val;
            }, 0) / mins.length;

        if (closes < value.pivot_points.low.low) {
          return 'short';
        }

        break;
      }

      if (long && value.pivot_points && value.pivot_points.high && value.pivot_points.high.high) {
        const candles1m = indicatorPeriod.getIndicator('candles_1m');
        const mins = candles1m.slice(-7);

        const closes =
          mins
            .map(c => c.close)
            .reduce((acc, val) => {
              return acc + val;
            }, 0) / mins.length;

        if (closes > value.pivot_points.high.high) {
          return 'long';
        }

        break;
      }
    }
  }

  getBacktestColumns() {
    return [
      {
        label: 'SMA 50/200',
        value: 'sma50',
        type: 'cross',
        cross: 'sma200'
      },
      {
        label: 'sma200',
        value: 'sma200'
      },
      {
        label: 'sma50',
        value: 'sma50'
      },
      {
        label: 'Pivot Points',
        value: 'pivot_points'
      },
      {
        label: 'candles_1m',
        value: 'candles_1m.close'
      },
      {
        label: 'candles',
        value: 'candles'
      },
      {
        label: 'debug',
        value: 'debug'
      }
    ];
  }

  getOptions() {
    return {
      period: '15m',
      left: 4,
      right: 2
    };
  }
};
