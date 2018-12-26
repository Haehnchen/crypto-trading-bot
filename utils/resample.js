let moment = require('moment')

module.exports = {
    /**
     * Resample eg 5m candle sticks into 15m or other minutes
     *
     * @param lookbackNewestFirst
     * @param minutes
     * @returns {Array}
     */
    resampleMinutes: function (lookbackNewestFirst, minutes) {
        if(lookbackNewestFirst.length === 0) {
            return []
        }

        if(lookbackNewestFirst.length > 1 && lookbackNewestFirst[0].time < lookbackNewestFirst[1].time) {
            throw 'Invalid candle stick order'
        }

        let grouped = []

        lookbackNewestFirst.forEach((candle) => {
            const start = moment(candle['time'] * 1000).subtract();
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

            const start = moment(candles[candles.length - 1]['time'] * 1000).add({'minutes': 1});
            const mod = minutes - (start.minute() % minutes);

            const group = moment(start).add(mod, "minutes").format('YYYY-MM-DDTHH:mm:00.000Z');

            merge.push({
                'time': parseInt(moment(group).format('X')),
                'open': candles[candles.length - 1]['open'],
                'high': Math.max(...x['high']),
                'low': Math.min(...x['low']),
                'close': candles[0]['close'],
                'volume': x['volume'].reduce((sum, a) => { return sum + Number(a) }, 0),
                '_time': group,
                '_candle_count': candles.length,
            })
        }

        // sort items and remove oldest item which can be incomplete
        return merge
            .sort((a, b) => b.time - a.time)
            .splice(0, merge.length - 1);
    },

    /**
     * Resample eg 5m candle sticks into 15m or other minutes
     *
     * @returns number
     * @param period
     */
    convertPeriodToMinute: function (period) {
        let unit = period.slice(-1).toLowerCase();

        switch (unit) {
            case 'm':
                return parseInt(period.substring(0, period.length - 1))
            case 'h':
                return parseInt(period.substring(0, period.length - 1) * 60)
            case 'd':
                return parseInt(period.substring(0, period.length - 1) * 60 * 24)
            case 'w':
                return parseInt(period.substring(0, period.length - 1) * 60 * 24 * 7)
            case 'y':
                return parseInt(period.substring(0, period.length - 1) * 60 * 24 * 7 * 356)
            default :
                throw 'Unsupported period unit: ' + period
        }
    }
}
