const SignalResult = require('../dict/signal_result');

module.exports = class {
  getName() {
    return 'obv_pump_dump';
  }

  buildIndicator(indicatorBuilder, options) {
    indicatorBuilder.add('obv', 'obv', '1m');

    indicatorBuilder.add('ema', 'ema', '1m', {
      length: 200
    });
  }

  async period(indicatorPeriod, options) {
    const triggerMultiplier = options.trigger_multiplier || 2;
    const triggerTimeWindows = options.trigger_time_windows || 3;

    const obv = indicatorPeriod.getIndicator('obv');

    if (!obv || obv.length <= 20) {
      return;
    }

    const price = indicatorPeriod.getPrice();
    const ema = indicatorPeriod.getIndicator('ema').slice(-1)[0];

    const debug = {
      obv: obv.slice(-1)[0],
      ema: ema
    };

    if (price > ema) {
      // long
      debug.trend = 'up';

      const before = obv.slice(-20, triggerTimeWindows * -1);

      const highest = before.sort((a, b) => b - a).slice(0, triggerTimeWindows);
      const highestOverage = highest.reduce((a, b) => a + b, 0) / highest.length;

      const current = obv.slice(triggerTimeWindows * -1);

      const currentAverage = current.reduce((a, b) => a + b, 0) / current.length;

      debug.highest_overage = highestOverage;
      debug.current_average = currentAverage;

      if (currentAverage < highestOverage) {
        return SignalResult.createEmptySignal(debug);
      }

      const difference = Math.abs(currentAverage / highestOverage);

      debug.difference = difference;

      if (difference >= triggerMultiplier) {
        return SignalResult.createSignal('long', debug);
      }
    } else {
      // short
      debug.trend = 'down';
    }

    return SignalResult.createEmptySignal(debug);
  }

  getOptions() {
    return {
      period: '15m',
      trigger_multiplier: 2,
      trigger_time_windows: 3
    };
  }
};
