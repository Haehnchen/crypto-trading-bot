const assert = require('assert');
const fs = require('fs');
const ta = require('../../src/utils/technical_analysis');

describe('#technical_analysis for candles', () => {
  const createCandleFixtures = function() {
    return JSON.parse(fs.readFileSync(`${__dirname}/fixtures/xbt-usd-5m.json`, 'utf8'));
  };

  it('technical_analysis for candles are returned', async () => {
    const result = await ta.getPredefinedIndicators(createCandleFixtures().reverse());

    assert.equal(result.ema_55.length, 490);
    assert.equal(result.sma_200.length, 291);

    assert.equal(8145, Math.round(result.ema_55[0]));
    assert.equal(7994, Math.round(result.sma_200[0]));
  });

  it('technical_analysis for options are created', async () => {
    const lookbacks = createCandleFixtures().reverse();

    const result = await ta.createIndicatorsLookback(lookbacks, [
      {
        indicator: 'ema',
        key: 'ema_55',
        options: {
          length: 55
        }
      },
      {
        indicator: 'sma',
        key: 'sma_200',
        options: {
          length: 200
        }
      },
      {
        indicator: 'macd',
        key: 'macd'
      },
      {
        indicator: 'obv',
        key: 'obv'
      },
      {
        indicator: 'ao',
        key: 'ao'
      },
      {
        indicator: 'macd_ext',
        key: 'macd_ext'
      },
      {
        indicator: 'macd_ext',
        key: 'macd_ext'
      },
      {
        indicator: 'macd_ext',
        key: 'macd_ext_dema',
        options: {
          default_ma_type: 'DEMA'
        }
      },
      {
        indicator: 'macd_ext',
        key: 'macd_ext_dema_slow',
        options: {
          default_ma_type: 'DEMA',
          fast_period: 16,
          slow_period: 39,
          signal_period: 9
        }
      },
      {
        indicator: 'bb',
        key: 'bb'
      },
      {
        indicator: 'bb_talib',
        key: 'bb_talib'
      },
      {
        indicator: 'mfi',
        key: 'mfi'
      },
      {
        indicator: 'rsi',
        key: 'rsi'
      },
      {
        indicator: 'pivot_points_high_low',
        key: 'pivot_points_high_low'
      },
      {
        indicator: 'pivot_points_high_low',
        key: 'pivot_points_high_low_2',
        options: {
          left: 20,
          right: 20
        }
      },
      {
        indicator: 'candles',
        key: 'candles'
      },
      {
        indicator: 'heikin_ashi',
        key: 'heikin_ashi'
      },
      {
        indicator: 'stoch',
        key: 'stoch'
      },
      {
        indicator: 'stoch_rsi',
        key: 'stoch_rsi'
      },
      {
        indicator: 'hma',
        key: 'hma',
        options: {
          length: 9,
          source: 'low'
        }
      },
      {
        indicator: 'wma',
        key: 'wma'
      },
      {
        indicator: 'dema',
        key: 'dema'
      },
      {
        indicator: 'tema',
        key: 'tema'
      },
      {
        indicator: 'trima',
        key: 'trima'
      },
      {
        indicator: 'kama',
        key: 'kama'
      },
      {
        indicator: 'vwma',
        key: 'vwma'
      },
      {
        indicator: 'atr',
        key: 'atr'
      },
      {
        indicator: 'roc',
        key: 'roc'
      },
      {
        indicator: 'adx',
        key: 'adx'
      },
      {
        indicator: 'volume_by_price',
        key: 'volume_by_price'
      },
      {
        indicator: 'zigzag',
        key: 'zigzag'
      },
      {
        indicator: 'volume_profile',
        key: 'volume_profile'
      },
      {
        indicator: 'ichimoku_cloud',
        key: 'ichimoku_cloud'
      },
      {
        indicator: 'psar',
        key: 'psar',
        options: {
          step: 0.01,
          max: 0.011
        }
      }
    ]);

    assert.equal(result.ema_55.length, 490);
    assert.equal(result.sma_200.length, 291);

    assert.equal(result.wma.length > 0, true);
    assert.equal(result.dema.length > 0, true);
    assert.equal(result.tema.length > 0, true);
    assert.equal(result.trima.length > 0, true);
    assert.equal(result.kama.length > 0, true);

    assert.equal(result.rsi.length > 0, true);
    assert.equal(result.mfi.length > 0, true);

    assert.equal(typeof result.rsi[0], 'number');
    assert.equal(typeof result.mfi[0], 'number');

    assert.equal(8145, Math.round(result.ema_55[0]));
    assert.equal(7994, Math.round(result.sma_200[0]));
    assert.equal(0.31, parseFloat(result.macd[1].histogram).toFixed(2));

    assert.equal(-12689695, parseFloat(result.obv[1]));
    assert.equal(-10.657352941176214, parseFloat(result.ao[1]));

    // test macd implementations
    assert.equal(-3.89, parseFloat(result.macd[result.macd.length - 1].histogram).toFixed(2));
    assert.equal(-4.07, parseFloat(result.macd_ext[result.macd_ext.length - 1].histogram).toFixed(2));

    assert.equal(2.5, parseFloat(result.macd_ext_dema[result.macd_ext_dema.length - 1].histogram).toFixed(2));
    assert.equal(
      1.12,
      parseFloat(result.macd_ext_dema_slow[result.macd_ext_dema_slow.length - 1].histogram).toFixed(2)
    );

    assert.equal(result.bb.length > 0, true);
    assert.equal(result.bb[0].lower < result.bb[0].middle, true);
    assert.equal(result.bb[0].middle < result.bb[0].upper, true);
    assert.equal(result.bb[0].lower < result.bb[0].upper, true);
    assert.equal(result.bb[0].width > 0, true);

    assert.equal(result.bb_talib.length > 0, true);
    assert.equal(result.bb_talib[0].lower < result.bb[0].middle, true);
    assert.equal(result.bb_talib[0].middle < result.bb[0].upper, true);
    assert.equal(result.bb_talib[0].lower < result.bb[0].upper, true);
    assert.equal(result.bb_talib[0].width > 0, true);

    assert.equal(result.stoch[0].stoch_k > 0, true);
    assert.equal(result.stoch[0].stoch_d > 0, true);

    assert.equal(result.stoch_rsi[5].stoch_k > 0, true);
    assert.equal(result.stoch_rsi[5].stoch_d > 0, true);

    assert.equal(result.pivot_points_high_low.filter(v => 'high' in v && 'close' in v.high).length > 2, true);
    assert.equal(result.pivot_points_high_low.filter(v => 'low' in v && 'close' in v.low).length > 2, true);

    assert.equal(
      result.pivot_points_high_low.filter(v => 'high' in v && 'close' in v.high).length >
        result.pivot_points_high_low_2.filter(v => 'high' in v && 'close' in v.high).length,
      true
    );

    assert.equal(result.candles.length, lookbacks.length);
    assert.equal(result.candles[0].time, lookbacks[0].time);
    assert.equal(result.candles[0].time < lookbacks[1].time, true);
    assert.equal(result.candles[result.candles.length - 1].time, lookbacks[result.candles.length - 1].time);

    assert.equal(result.heikin_ashi.length, lookbacks.length);
    assert.equal(result.heikin_ashi[0].time, lookbacks[0].time);
    assert.equal(result.heikin_ashi[0].time < lookbacks[1].time, true);
    assert.equal(result.heikin_ashi[result.heikin_ashi.length - 1].time, lookbacks[result.heikin_ashi.length - 1].time);

    assert.equal(result.hma.length > 0, true);
    assert.equal(result.hma[0] > 0, true);

    assert.equal(result.vwma.length > 0, true);
    assert.equal(result.vwma[0] > 0, true);

    assert.equal(result.atr[0] > 0, true);
    assert.equal(result.roc[0] < 0, true);

    assert.equal(result.adx[0] > 0, true);

    assert.equal(result.psar[0], 8144.5);

    const volumeByPrice = result.volume_by_price[0][0];

    assert.equal(volumeByPrice.low > 0, true);
    assert.equal(volumeByPrice.high > 0, true);
    assert.equal(volumeByPrice.volume > 0, true);
    assert.equal(result.volume_by_price[0].length, 12);

    assert.equal(result.zigzag.filter(v => v.turningPoint === true).length > 0, true);

    assert.equal(result.volume_profile.length, 14);

    const ichimokuCloud = Object.keys(result.ichimoku_cloud[0]);
    assert.equal(ichimokuCloud.includes('base'), true);
    assert.equal(ichimokuCloud.includes('conversion'), true);
    assert.equal(ichimokuCloud.includes('spanA'), true);
    assert.equal(ichimokuCloud.includes('spanB'), true);
  });

  it('technical_analysis for bollinger percent', () => {
    assert.equal(-0.2, ta.getBollingerBandPercent(80, 200, 100));
    assert.equal(1.2, ta.getBollingerBandPercent(220, 200, 100));
    assert.equal(0.5, ta.getBollingerBandPercent(150, 200, 100));
    assert.equal(-0.25, ta.getBollingerBandPercent(75, 200, 100));
  });

  it('technical_analysis for pivot points', () => {
    assert.deepEqual(ta.getPivotPoints([1, 2, 1], 2, 1), {});
    assert.deepEqual(ta.getPivotPoints([1], 0, 0), {});

    assert.deepEqual(ta.getPivotPoints([1, 2, 3, 4, 5, 4, 3, 2, 1], 4, 4), { high: 5 });
    assert.deepEqual(ta.getPivotPoints([1, 6, 3, 4, 5, 4, 3, 2, 1], 4, 4), {});
    assert.deepEqual(ta.getPivotPoints([1, 2, 3, 4, 5, 4, 3, 2, 6], 4, 4), {});

    assert.deepEqual(ta.getPivotPoints([5, 4, 3, 2, 1, 2, 3, 4, 5], 4, 4), { low: 1 });
    assert.deepEqual(ta.getPivotPoints([5, 4, 3, 2, 1, 2, 3, 0, 5], 4, 4), {});
    assert.deepEqual(ta.getPivotPoints([5, 0, 3, 2, 1, 2, 3, 4, 5], 4, 4), {});
  });

  it('technical_analysis for pivot points with wicks for a range', () => {
    const highs = [1, 2, 3, 4, 5, 4, 3, 2, 1].map(v => {
      return { close: v, high: v * 1.2, low: v * 0.8 };
    });
    assert.deepEqual(ta.getPivotPointsWithWicks(highs, 4, 4), { high: { close: 5, high: 6 } });

    const lows = [5, 4, 3, 2, 1, 2, 3, 4, 5].map(v => {
      return { close: v, high: v * 1.2, low: v * 0.8 };
    });
    assert.deepEqual(ta.getPivotPointsWithWicks(lows, 4, 4), { low: { close: 1, low: 0.8 } });
  });
});
