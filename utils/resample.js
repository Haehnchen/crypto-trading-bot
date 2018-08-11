let moment = require('moment')

module.exports = {
    /**
     * Resample eg 5m candle sticks into 15m or other minutes
     *
     * @param candlesticks
     * @param minutes
     * @returns {Array}
     */
    resampleMinutes: function (candlesticks, minutes) {
        let grouped = []

        candlesticks.forEach((candle) => {
            const start = moment(candle['time']).subtract();
            const remainder = minutes - (start.minute() % minutes);

            const group = moment(start).add(remainder, "minutes").format('YYYY-MM-DD:HH:mm:00.000Z');

            if (!grouped[group])  {
                grouped[group] = [];
            }

            grouped[group].push(candle)
        })

        let merge = []

        for(let key in grouped) {
            let candles = grouped[key]

            let x = {'open': [], 'high': [], 'low': [], 'close': [], 'volume': []}

            candles.forEach((candle) => {
                x['open'].push(candle['open'])
                x['high'].push(candle['high'])
                x['low'].push(candle['low'])
                x['close'].push(candle['close'])
                x['volume'].push(candle['volume'])
            })

            const start = moment(candles[candles.length - 1]['time']).add({'minutes': 1});
            const mod = minutes - (start.minute() % minutes);

            const group = moment(start).add(mod, "minutes").format('YYYY-MM-DDTHH:mm:00.000Z');

            merge.push({
                'time': moment(group).format('X'),
                'open': candles[candles.length - 1]['open'],
                'high': Math.max(...x['high']),
                'low': Math.min(...x['low']),
                'close': candles[0]['close'],
                'volume': x['volume'].reduce(function(sum, a) { return sum + Number(a) }, 0),
                '_time': group,
                '_candle_count': candles.length,
            })
        }

        return merge;
    },
}
