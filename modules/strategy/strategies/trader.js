const { SD } = require('technicalindicators');
const { SMA } = require('technicalindicators');
const { Lowest } = require('technicalindicators');
const { isTrendingUp } = require('technicalindicators');
const { isTrendingDown } = require('technicalindicators');
const SignalResult = require('../dict/signal_result');
const TA = require('../../../utils/technical_analysis');
const TechnicalPattern = require('../../../utils/technical_pattern');
const resample = require('../../../utils/resample');
const TechnicalAnalysis = require('../../../utils/technical_analysis');

module.exports = class {
  getName() {
    return 'trader';
  }

  buildIndicator(indicatorBuilder, options) {
    indicatorBuilder.add('candles_1m', 'candles', '1m');
    indicatorBuilder.add('bb', 'bb', '15m', {
      length: 40
    });
  }

  async period(indicatorPeriod, options) {
    const currentValues = indicatorPeriod.getLatestIndicators();

    const result = SignalResult.createEmptySignal(currentValues);

    const candles1m = indicatorPeriod.getIndicator('candles_1m');
    if (!candles1m) {
      return result;
    }

    const candles3m = resample.resampleMinutes(candles1m.slice().reverse(), '3');

    const foo = TechnicalAnalysis.getPivotPoints(
      candles1m.slice(-10).map(c => c.close),
      3,
      3
    );

    const bb = indicatorPeriod.getLatestIndicator('bb');

    const lastCandle = candles1m.slice(-1)[0];
    result.addDebug('price2', lastCandle.close);

    if (bb && lastCandle && lastCandle.close > bb.upper) {
      result.addDebug('v', 'success');

      const bb = indicatorPeriod.getIndicator('bb');

      const values = bb
        .slice(-10)
        .reverse()
        .map(b => b.width);
      const value = Math.min(...values);

      if (currentValues.bb.width < 0.05) {
        result.addDebug('x', currentValues.bb.width);
        result.setSignal('long');
      }
    }

    result.addDebug('pivot', foo);

    result.mergeDebug(TechnicalPattern.volumePump(candles3m.slice().reverse() || []));

    return result;
  }

  getBacktestColumns() {
    return [
      {
        label: 'price2',
        value: 'price2'
      },
      {
        label: 'RSI',
        value: 'rsi'
      },
      {
        label: 'roc',
        value: 'roc_1m'
      },
      {
        label: 'roc_ma',
        value: 'roc_ma',
        type: 'icon'
      },
      {
        label: 'Vol',
        value: 'candles_1m.volume'
      },
      {
        label: 'VolSd',
        value: 'volume_sd'
      },
      {
        label: 'VolV',
        value: 'volume_v'
      },
      {
        label: 'hint',
        value: 'hint',
        type: 'icon'
      },
      {
        label: 'v',
        value: 'v',
        type: 'icon'
      },
      {
        label: 'x',
        value: 'x'
      },
      {
        label: 'pivot',
        value: 'pivot'
      }
    ];
  }

  getOptions() {
    return {
      period: '15m'
    };
  }
};
