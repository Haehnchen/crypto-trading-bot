let assert = require('assert');
let ta = require('../../utils/technical_analysis');

let fs = require('fs');

describe('#technical_analysis for candles', () => {
    it('technical_analysis for candles are returned', async () => {
        const result = await ta.getIndicatorsLookbacks(createCandleFixtures().reverse());

        assert.equal(result['ema_55'].length, 490)
        assert.equal(result['sma_200'].length, 291)

        assert.equal(8145, Math.round(result['ema_55'][0]))
        assert.equal(7994, Math.round(result['sma_200'][0]))
    })

    it('technical_analysis for options are created', async () => {
        let lookbacks = createCandleFixtures().reverse()

        const result = await ta.createIndicatorsLookback(lookbacks, [
            {
                'indicator': 'ema',
                'key': 'ema_55',
                'options': {
                    'length': 55,
                },
            },
            {
                'indicator': 'sma',
                'key': 'sma_200',
                'options': {
                    'length': 200,
                },
            },
            {
                'indicator': 'macd',
                'key': 'macd',
            },
            {
                'indicator': 'obv',
                'key': 'obv',
            },
            {
                'indicator': 'ao',
                'key': 'ao',
            },
            {
                'indicator': 'macd_ext',
                'key': 'macd_ext',
            },
            {
                'indicator': 'macd_ext',
                'key': 'macd_ext',
            },
            {
                'indicator': 'macd_ext',
                'key': 'macd_ext_dema',
                'options': {
                    'default_ma_type': 'DEMA',
                },
            },
            {
                'indicator': 'macd_ext',
                'key': 'macd_ext_dema_slow',
                'options': {
                    'default_ma_type': 'DEMA',
                    'fast_period': 16,
                    'slow_period': 39,
                    'signal_period': 9,
                },
            },
            {
                'indicator': 'bb',
                'key': 'bb',
            },
            {
                'indicator': 'bb_talib',
                'key': 'bb_talib',
            },
            {
                'indicator': 'mfi',
                'key': 'mfi',
            },
            {
                'indicator': 'rsi',
                'key': 'rsi',
            },
            {
                'indicator': 'pivot_points_high_low',
                'key': 'pivot_points_high_low',
            },
            {
                'indicator': 'pivot_points_high_low',
                'key': 'pivot_points_high_low_2',
                'options': {
                    'left': 20,
                    'right': 20,
                },
            },
            {
                'indicator': 'candles',
                'key': 'candles',
            },
            {
                'indicator': 'stoch',
                'key': 'stoch',
            },
            {
                'indicator': 'stoch_rsi',
                'key': 'stoch_rsi',
            },
            {
                'indicator': 'hma',
                'key': 'hma',
            },
            {
                'indicator': 'vwma',
                'key': 'vwma',
            },
        ]);

        assert.equal(result['ema_55'].length, 490)
        assert.equal(result['sma_200'].length, 291)

        assert.equal(result['rsi'].length > 0, true)
        assert.equal(result['mfi'].length > 0, true)

        assert.equal(typeof result['rsi'][0], 'number')
        assert.equal(typeof result['mfi'][0], 'number')

        assert.equal(8145, Math.round(result['ema_55'][0]))
        assert.equal(7994, Math.round(result['sma_200'][0]))
        assert.equal(0.31, parseFloat(result['macd'][1]['histogram']).toFixed(2))

        assert.equal(-12689695, parseFloat(result['obv'][1]))
        assert.equal(-10.657352941176214, parseFloat(result['ao'][1]))

        // test macd implementations
        assert.equal(-3.89, parseFloat(result['macd'][result['macd'].length - 1]['histogram']).toFixed(2))
        assert.equal(-4.07, parseFloat(result['macd_ext'][result['macd_ext'].length - 1]['histogram']).toFixed(2))

        assert.equal(2.50, parseFloat(result['macd_ext_dema'][result['macd_ext_dema'].length - 1]['histogram']).toFixed(2))
        assert.equal(1.12, parseFloat(result['macd_ext_dema_slow'][result['macd_ext_dema_slow'].length - 1]['histogram']).toFixed(2))

        assert.equal(result['bb'].length > 0, true)
        assert.equal(result['bb'][0]['lower'] <  result['bb'][0]['middle'], true)
        assert.equal(result['bb'][0]['middle'] <  result['bb'][0]['upper'], true)
        assert.equal(result['bb'][0]['lower'] <  result['bb'][0]['upper'], true)
        assert.equal(result['bb'][0]['width'] > 0, true)

        assert.equal(result['bb_talib'].length > 0, true)
        assert.equal(result['bb_talib'][0]['lower'] <  result['bb'][0]['middle'], true)
        assert.equal(result['bb_talib'][0]['middle'] <  result['bb'][0]['upper'], true)
        assert.equal(result['bb_talib'][0]['lower'] <  result['bb'][0]['upper'], true)
        assert.equal(result['bb_talib'][0]['width'] > 0, true)

        assert.equal(result['stoch'][0]['stoch_k'] > 0, true)
        assert.equal(result['stoch'][0]['stoch_d'] > 0, true)

        assert.equal(result['stoch_rsi'][5]['stoch_k'] > 0, true)
        assert.equal(result['stoch_rsi'][5]['stoch_d'] > 0, true)

        assert.equal(result['pivot_points_high_low'].filter(v => 'high' in v && 'close' in v['high']).length > 2, true);
        assert.equal(result['pivot_points_high_low'].filter(v => 'low' in v && 'close' in v['low']).length > 2, true);

        assert.equal(result['pivot_points_high_low'].filter(v => 'high' in v&& 'close' in v['high']).length > result['pivot_points_high_low_2'].filter(v => 'high' in v&& 'close' in v['high']).length, true);

        assert.equal(result['candles'].length, lookbacks.length);
        assert.equal(result['candles'][0].time, lookbacks[0].time);
        assert.equal(result['candles'][0].time < lookbacks[1].time, true);
        assert.equal(result['candles'][result['candles'].length - 1].time, lookbacks[result['candles'].length - 1].time);

        assert.equal(result['hma'].length > 0, true)
        assert.equal(result['hma'][0] > 0, true)

        assert.equal(result['vwma'].length > 0, true)
        assert.equal(result['vwma'][0] > 0, true)
    })

    it('technical_analysis for bollinger percent', () => {
        assert.equal(-0.2, ta.getBollingerBandPercent(80, 200, 100))
        assert.equal(1.20, ta.getBollingerBandPercent(220, 200, 100))
        assert.equal(0.50, ta.getBollingerBandPercent(150, 200, 100))
        assert.equal(-0.25, ta.getBollingerBandPercent(75, 200, 100))
    });

    it('technical_analysis for pivot points', () => {
        assert.deepEqual(ta.getPivotPoints([1, 2, 1], 2, 1), {})
        assert.deepEqual(ta.getPivotPoints([1], 0, 0), {})

        assert.deepEqual(ta.getPivotPoints([1, 2, 3, 4, 5, 4, 3, 2, 1], 4, 4), {'high': 5})
        assert.deepEqual(ta.getPivotPoints([1, 6, 3, 4, 5, 4, 3, 2, 1], 4, 4), {})
        assert.deepEqual(ta.getPivotPoints([1, 2, 3, 4, 5, 4, 3, 2, 6], 4, 4), {})

        assert.deepEqual(ta.getPivotPoints([5, 4, 3, 2, 1, 2, 3, 4, 5], 4, 4), {'low': 1})
        assert.deepEqual(ta.getPivotPoints([5, 4, 3, 2, 1, 2, 3, 0, 5], 4, 4), {})
        assert.deepEqual(ta.getPivotPoints([5, 0, 3, 2, 1, 2, 3, 4, 5], 4, 4), {})
    });

    it('technical_analysis for pivot points with wicks for a range', () => {
        let highs = [1, 2, 3, 4, 5, 4, 3, 2, 1].map(v => {return {'close': v, 'high': v * 1.2, 'low': v * 0.8}})
        assert.deepEqual(ta.getPivotPointsWithWicks(highs, 4, 4), {high: { close: 5, high: 6 }})

        let lows = [5, 4, 3, 2, 1, 2, 3, 4, 5].map(v => {return {'close': v, 'high': v * 1.2, 'low': v * 0.8}})
        assert.deepEqual(ta.getPivotPointsWithWicks(lows, 4, 4), {low: { close: 1, low: 0.8 }})
    });

    var createCandleFixtures = function() {
        return JSON.parse(fs.readFileSync(__dirname + '/fixtures/xbt-usd-5m.json', 'utf8'));
    }
});
