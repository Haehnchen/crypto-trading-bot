const { SD } = require('technicalindicators');
const TA = require('../../../utils/technical_analysis');

const SignalResult = require('../dict/signal_result');

module.exports = class {
  getName() {
    return 'noop';
  }

  buildIndicator(indicatorBuilder, options) {
    indicatorBuilder.add('bb', 'bb', '15m');
    indicatorBuilder.add('rsi', 'rsi', '15m');
    indicatorBuilder.add('mfi', 'mfi', '15m');
    indicatorBuilder.add('volume_profile', 'volume_profile', '15m');
    indicatorBuilder.add('zigzag', 'zigzag', '15m');

    indicatorBuilder.add('pivot_points_high_low', 'pivot_points_high_low', '15m', {
      left: 14,
      right: 14
    });

    indicatorBuilder.add('sma200', 'sma', '15m', {
      length: 200
    });

    indicatorBuilder.add('sma50', 'sma', '15m', {
      length: 50
    });

    indicatorBuilder.add('candles', 'candles');
  }

  async period(indicatorPeriod, options) {
    const currentValues = indicatorPeriod.getLatestIndicators();

    const bollinger = indicatorPeriod.getIndicator('bb');

    if (bollinger && currentValues.bb) {
      const standardDeviation = SD.calculate({
        period: 150,
        values: bollinger.slice(-200).map(b => b.width)
      });

      currentValues.bb.sd = standardDeviation.slice(-1)[0];
    }

    const currentBB = indicatorPeriod.getLatestIndicator('bb');
    if (currentBB && currentValues.bb) {
      currentValues.bb.percent = TA.getBollingerBandPercent(
        indicatorPeriod.getPrice(),
        currentBB.upper,
        currentBB.lower
      );
    }

    const intl = new Intl.NumberFormat('en-US', { minimumSignificantDigits: 3, maximumSignificantDigits: 4 });

    currentValues.ranges = (indicatorPeriod.getIndicator('volume_profile') || [])
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 3)
      .map(v => `${intl.format(v.rangeStart)}-${intl.format(v.rangeEnd)}`)
      .join(', ');

    const emptySignal = SignalResult.createEmptySignal(currentValues);

    // entry or exit
    if (!indicatorPeriod.getLastSignal()) {
      const dice = parseFloat(options.dice || 6);
      const diceSize = parseFloat(options.dice_size || 12);

      const number = Math.floor(Math.random() * diceSize) + 1;
      emptySignal.addDebug('message', `${number}`);
      if (number === dice) {
        const longOrShort = Math.random() > 0.5 ? 'long' : 'short';
        emptySignal.setSignal(longOrShort);
      }
    }

    // close on profit or lose
    if (indicatorPeriod.getLastSignal()) {
      if (indicatorPeriod.getProfit() > 2) {
        // take profit
        emptySignal.addDebug('message', 'TP');
        emptySignal.setSignal('close');
      } else if (indicatorPeriod.getProfit() < -2) {
        // stop loss
        emptySignal.addDebug('message', 'SL');
        emptySignal.setSignal('close');
      }
    }

    return emptySignal;
  }

  getBacktestColumns() {
    return [
      {
        label: 'BollDev',
        value: 'bb.width',
        type: 'cross',
        cross: 'bb.sd'
      },
      {
        label: 'BollPct',
        value: 'bb.percent',
        type: 'oscillator',
        range: [1, 0]
      },
      {
        label: 'rsi',
        value: 'rsi',
        type: 'oscillator'
      },
      {
        label: 'mfi',
        value: 'mfi',
        type: 'oscillator'
      },
      {
        label: 'SMA 50/200',
        value: 'sma50',
        type: 'cross',
        cross: 'sma200'
      },
      {
        label: 'Pivot Points',
        value: 'pivot_points_high_low'
      },
      {
        label: 'Candles',
        value: 'candles.close'
      },
      {
        label: 'Top Volume Ranges',
        value: 'ranges'
      },
      {
        label: 'dice',
        value: 'message'
      },
      {
        label: 'zigzag',
        value: row => (row.zigzag && row.zigzag.turningPoint === true ? 'warning' : undefined),
        type: 'icon'
      }
    ];
  }

  getOptions() {
    return {
      period: '15m',
      dice: 6,
      dice_size: 12
    };
  }

  getTickPeriod() {
    return '1m';
  }
};
