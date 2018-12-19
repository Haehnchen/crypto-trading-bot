'use strict';

let Resample = require('../utils/resample');

module.exports = class TechnicalAnalysisValidator {
    isValidCandleStickLookback(lookbackNewestFirst, period) {
        if(lookbackNewestFirst.length === 0) {
            return false
        }

        if(lookbackNewestFirst.length > 1 && lookbackNewestFirst[0].time < lookbackNewestFirst[1].time) {
            return false
        }

        // check if candle to close no outside candle size with a little buffer
        let allowedOutdatedWindow = Resample.convertPeriodToMinute(period) * 1.76
        let candleOpenToCurrentTime = Math.abs((Math.floor(Date.now() / 1000) - lookbackNewestFirst[0]['time']) / 60)

        if (candleOpenToCurrentTime > allowedOutdatedWindow) {
            return false
        }

        // @TODO: check candles window "times" against the period

        return true
    }
}
