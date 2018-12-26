let assert = require('assert');
let Resample = require('../../utils/resample');
let moment = require('moment')
let fs = require('fs');

describe('#resample of candles', () => {
    it('should resample 1 hour candles', () => {
        let candles = Resample.resampleMinutes(createCandleFixtures(), 60)

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

    it('should resample 15m candles', () => {
        let candles = Resample.resampleMinutes(createCandleFixtures(), 15)

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

    it('should format period based on unit', () => {
        assert.strictEqual(Resample.convertPeriodToMinute('15m'), 15)
        assert.strictEqual(Resample.convertPeriodToMinute('30M'), 30)
        assert.strictEqual(Resample.convertPeriodToMinute('1H'), 60)
        assert.strictEqual(Resample.convertPeriodToMinute('2h'), 120)
        assert.strictEqual(Resample.convertPeriodToMinute('1w'), 10080)
        assert.strictEqual(Resample.convertPeriodToMinute('2w'), 20160)
        assert.strictEqual(Resample.convertPeriodToMinute('1y'), 3588480)
    });

    it('test that resample starting time is matching given candle lookback', () => {
        let candles = []

        for (let i = 1; i < 23; i++) {
            let start = moment("2014-02-27T10:23:00")
            let time = start
                .minute(Math.floor(start.minute() / 15) * 15)
                .second(33)
                .subtract(15 * i, 'minutes');

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

        let resampleCandles = Resample.resampleMinutes(candles, 60)

        // this must not be in the future? (at least for Bitmex it does not match)
        // check how changes provide this: candles are in future unto close or when the start
        assert.equal(new Date(resampleCandles[0]['time'] * 1000).getHours(), 11)

        let firstFullCandle = resampleCandles[1]
        assert.equal(firstFullCandle['_candle_count'], 4)
        assert.equal(firstFullCandle['time'], 1393491600)

        assert.equal(resampleCandles.length, 6)

        assert.equal(resampleCandles[0].time, 1393495200)
        assert.equal(resampleCandles[4].time, 1393480800)
        assert.equal(resampleCandles[4]['_candle_count'], 4)
    });

    let createCandleFixtures = function() {
        return JSON.parse(fs.readFileSync(__dirname + '/fixtures/xbt-usd-5m.json', 'utf8'));
    }
});
