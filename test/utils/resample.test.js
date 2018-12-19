let assert = require('assert');
let resmaple = require('../../utils/resample');
let moment = require('moment')
let fs = require('fs');

describe('#resample of candles', function() {
    it('should resample 1 hour candles', function() {
        let candles = resmaple.resampleMinutes(createCandleFixtures(), 60)

        let firstFullCandle = candles[1]

        assert.equal(12, firstFullCandle['_candle_count'])

        assert.equal(firstFullCandle['time'], 1533142800)
        assert.equal(firstFullCandle['open'], 7598.5)
        assert.equal(firstFullCandle['high'], 7609.5)
        assert.equal(firstFullCandle['low'], 7530)
        assert.equal(firstFullCandle['close'], 7557)
        assert.equal(firstFullCandle['volume'], 170512826)

        assert.equal(candles[2]['time'], 1533139200)
    });

    it('should resample 15m candles', function() {
        let candles = resmaple.resampleMinutes(createCandleFixtures(), 15)

        let firstFullCandle = candles[1]

        assert.equal(3, firstFullCandle['_candle_count'])

        assert.equal(firstFullCandle['time'], 1533142800)
        assert.equal(firstFullCandle['open'], 7545.5)
        assert.equal(firstFullCandle['high'], 7557)
        assert.equal(firstFullCandle['low'], 7530)
        assert.equal(firstFullCandle['close'], 7557)
        assert.equal(firstFullCandle['volume'], 57004287)

        assert.equal(candles[2]['time'], 1533141900)
    });

    it('should format period based on unit', function() {
        assert.equal(resmaple.convertPeriodToMinute('15m'), 15)
        assert.equal(resmaple.convertPeriodToMinute('30M'), 30)
        assert.equal(resmaple.convertPeriodToMinute('1H'), 60)
        assert.equal(resmaple.convertPeriodToMinute('2h'), 120)
        assert.equal(resmaple.convertPeriodToMinute('1w'), 10080)
        assert.equal(resmaple.convertPeriodToMinute('2w'), 20160)
        assert.equal(resmaple.convertPeriodToMinute('1y'), 3588480)
    });

    it('test that resample starting time is matching given candle lookback', function() {
        let candles = []

        for (let i = 1; i < 20; i++) {
            let time = moment().minute(Math.floor(moment().minute() / 15) * 15).second(0).subtract(15 * i, 'minutes');

            candles.push({
                'time': time.unix(),
                'volume': i * 100,
                'open': i * 2,
                'close': i * 2.1,
                'high': i * 1.1,
                'low': i * 0.9,
                '_time': time,
            })
        }

        let resampleCandles = resmaple.resampleMinutes(candles, 60)

        // this must not be in the future? (at least for Bitmex it does not match)
        // check how changes provide this: candles are in future unto close or when the start
        assert.equal(new Date(resampleCandles[0]['time'] * 1000).getHours(), new Date().getHours() + 1)

        let firstFullCandle = resampleCandles[1]
        assert.equal(4, firstFullCandle['_candle_count'])
    });

    let createCandleFixtures = function() {
        return JSON.parse(fs.readFileSync(__dirname + '/fixtures/xbt-usd-5m.json', 'utf8'));
    }
});
