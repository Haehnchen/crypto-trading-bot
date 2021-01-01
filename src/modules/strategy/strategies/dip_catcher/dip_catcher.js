const SignalResult = require('../../dict/signal_result');

module.exports = class DipCatcher {
  getName() {
    return 'dip_catcher';
  }

  buildIndicator(indicatorBuilder, options) {
    // line for short entry or long exit
    indicatorBuilder.add('hma_high', 'hma', options.period, {
      length: options.hma_high_period || 12,
      source: options.hma_high_candle_source || 'high'
    });

    // line for long entry or short exit
    indicatorBuilder.add('hma_low', 'hma', options.period, {
      length: options.hma_low_period || 12,
      source: options.hma_low_candle_source || 'low'
    });

    // basic price normalizer
    indicatorBuilder.add('hma', 'hma', options.period, {
      length: 9
    });

    // our main direction
    const trendCloudMultiplier = options.trend_cloud_multiplier || 4;
    indicatorBuilder.add('cloud', 'ichimoku_cloud', options.period, {
      conversionPeriod: 9 * trendCloudMultiplier,
      basePeriod: 26 * trendCloudMultiplier,
      spanPeriod: 52 * trendCloudMultiplier,
      displacement: 26 * trendCloudMultiplier
    });

    indicatorBuilder.add('bb', 'bb', '15m');
  }

  period(indicatorPeriod) {
    const currentValues = indicatorPeriod.getLatestIndicators();

    const hma = indicatorPeriod.getIndicator('hma').slice(-2);
    const hmaLow = indicatorPeriod.getIndicator('hma_low').slice(-2);
    const hmaHigh = indicatorPeriod.getIndicator('hma_high').slice(-2);
    const bb = indicatorPeriod.getIndicator('bb').slice(-2);
    const cloud = indicatorPeriod.getIndicator('cloud').slice(-1);

    const emptySignal = SignalResult.createEmptySignal(currentValues);

    if (!cloud[0] || !hma[0]) {
      return emptySignal;
    }

    const lastSignal = indicatorPeriod.getLastSignal();

    // follow the main trend with entries
    const isLong = hma[0] > cloud[0].spanB;
    emptySignal.addDebug('trend', isLong);

    if (hmaLow[0] > bb[0].lower && hmaLow[1] < bb[1].lower) {
      if (!lastSignal && isLong) {
        emptySignal.addDebug('message', 'long_lower_cross');

        emptySignal.setSignal('long');
      } else if (lastSignal) {
        emptySignal.setSignal('close');
      }
    }

    if (hmaHigh[0] < bb[0].upper && hmaHigh[1] > bb[1].upper) {
      if (!lastSignal && !isLong) {
        emptySignal.addDebug('message', 'short_upper_cross');

        emptySignal.setSignal('short');
      } else if (lastSignal) {
        emptySignal.setSignal('close');
      }
    }

    return emptySignal;
  }

  getBacktestColumns() {
    return [
      {
        label: 'bb_hma',
        value: row => {
          if (!row.bb) {
            return undefined;
          }

          if (row.hma < row.bb.lower) {
            return 'success';
          }

          if (row.hma > row.bb.upper) {
            return 'danger';
          }

          return undefined;
        },
        type: 'icon'
      },
      {
        label: 'trend',
        value: row => {
          if (typeof row.trend !== 'boolean') {
            return undefined;
          }

          return row.trend === true ? 'success' : 'danger';
        },
        type: 'icon'
      },
      {
        label: 'message',
        value: 'message'
      }
    ];
  }

  getOptions() {
    return {
      period: '15m',
      trend_cloud_multiplier: 4,
      hma_high_period: 9,
      hma_high_candle_source: 'close',
      hma_low_period: 9,
      hma_low_candle_source: 'close'
    };
  }
};
