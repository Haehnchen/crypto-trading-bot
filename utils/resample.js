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

        let group = []

        let secs = minutes * 60
        lookbackNewestFirst.forEach((candle) => {
            const nextWindow = candle['time'] - (candle['time'] % secs) + secs;

            if (!group[nextWindow])  {
                group[nextWindow] = [];
            }

            group[nextWindow].push(candle)
        })

        let merge = []

        for(let time in group) {
            let candles = group[time]

            let x = {'open': [], 'high': [], 'low': [], 'close': [], 'volume': []}

            candles.forEach((candle) => {
                x['open'].push(candle['open'])
                x['high'].push(candle['high'])
                x['low'].push(candle['low'])
                x['close'].push(candle['close'])
                x['volume'].push(candle['volume'])
            })

            let sorted = candles.slice().sort((a, b) => {
                return b.time - a.time;
            });

            merge.push({
                'time': time,
                'open': sorted[sorted.length - 1]['open'],
                'high': Math.max(...x['high']),
                'low': Math.min(...x['low']),
                'close': sorted[0]['close'],
                'volume': x['volume'].reduce((sum, a) => { return sum + Number(a) }, 0),
                '_time': new Date(time * 1000),
                '_candle_count': candles.length,
                '_candles': sorted,
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
