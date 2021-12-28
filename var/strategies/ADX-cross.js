const SignalResult = require('../../src/modules/strategy/dict/signal_result.js');

module.exports = class Dema {
  getName() {
    return 'ADX cross';
  }

  buildIndicator(indicatorBuilder, options) {
    if (!options.period) {
      throw Error('Invalid period');
    }

    indicatorBuilder.add('adx_dmi', 'adx_dmi', options.period, {
      period: options.adx_length
    });
  }

  period(indicatorPeriod, options) {
    const adx = indicatorPeriod.getLatestIndicator('adx_dmi');
    const lastSignal = indicatorPeriod.getLastSignal();
    const debug = {
      lastSignal: lastSignal,
      adx: adx
    };

    const signal = SignalResult.createEmptySignal(debug);

    if (adx !== undefined && adx.adx >= options.threshold) {
      if (adx.pdi > adx.mdi && lastSignal !== 'long') {
        signal.setSignal('long');
      } else if (adx.pdi < adx.mdi && lastSignal !== 'short') {
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
      period: '15m',
      threshold: 20,
      adx_length: 14
    };
  }
};
