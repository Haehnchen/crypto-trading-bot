const Resample = require('../utils/resample');

module.exports = class TechnicalAnalysisValidator {
  isValidCandleStickLookback(lookbackNewestFirst, period, logger) {
    if (lookbackNewestFirst.length === 0) {
      return false;
    }

    if (lookbackNewestFirst.length > 1 && lookbackNewestFirst[0].time < lookbackNewestFirst[1].time) {
      return false;
    }

    // check if candle to close no outside candle size with a little buffer
    let factor = 1.76;

    // we only get candles if we trades inside this range
    // as low timeframes can be silent allow some failings
    const minutes = Resample.convertPeriodToMinute(period);
    if (minutes === 1) {
      factor = 40;
    } else if (minutes === 2) {
      factor = 20;
    } else if (minutes < 10) {
      factor = 4;
    }

    const allowedOutdatedWindow = minutes * factor;
    const candleOpenToCurrentTime = Math.abs((Math.floor(Date.now() / 1000) - lookbackNewestFirst[0].time) / 60);

    if (candleOpenToCurrentTime > allowedOutdatedWindow) {
      if(logger) {
        logger.info(`${Date.now() / 1000} - ${lookbackNewestFirst[0].time}`)
      }
      return false;
    }

    // @TODO: check candles window "times" against the period

    return true;
  }
};
