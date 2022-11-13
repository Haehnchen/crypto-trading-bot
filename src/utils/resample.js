module.exports = {
  /**
   * Resample eg 5m candle sticks into 15m or other minutes
   *
   * @param lookbackNewestFirst
   * @param minutes
   * @returns {Array}
   */
  resampleMinutes: function(lookbackNewestFirst, minutes) {
    if (lookbackNewestFirst.length === 0) {
      return [];
    }

    if (lookbackNewestFirst.length > 1 && lookbackNewestFirst[0].time < lookbackNewestFirst[1].time) {
      throw 'Invalid candle stick order';
    }

    // group candles by its higher resample time
    const resampleCandleGroup = [];

    const secs = minutes * 60;
    lookbackNewestFirst.forEach(candle => {
      const mod = candle.time % secs;

      const resampleCandleClose =
        mod === 0
          ? candle.time // we directly catch the window: eg full hour matched
          : candle.time - mod + secs; // we calculate the next full window in future where es candle is closing

      // store the candle inside the main candle close
      if (!resampleCandleGroup[resampleCandleClose]) {
        resampleCandleGroup[resampleCandleClose] = [];
      }

      resampleCandleGroup[resampleCandleClose].push(candle);
    });

    const merge = [];

    for (const candleCloseTime in resampleCandleGroup) {
      const candles = resampleCandleGroup[candleCloseTime];

      const x = { open: [], high: [], low: [], close: [], volume: [] };

      candles.forEach(candle => {
        x.open.push(candle.open);
        x.high.push(candle.high);
        x.low.push(candle.low);
        x.close.push(candle.close);
        x.volume.push(candle.volume);
      });

      const sortHighToLow = candles.slice().sort((a, b) => {
        return b.time - a.time;
      });

      merge.push({
        time: parseInt(candleCloseTime),
        open: sortHighToLow[sortHighToLow.length - 1].open,
        high: Math.max(...x.high),
        low: Math.min(...x.low),
        close: sortHighToLow[0].close,
        volume: x.volume.reduce((sum, a) => sum + Number(a), 0),
        _time: new Date(candleCloseTime * 1000),
        _candle_count: candles.length,
        _candles: sortHighToLow
      });
    }

    // sort items and remove oldest item which can be incomplete
    return merge.sort((a, b) => b.time - a.time).splice(0, merge.length - 1);
  },

  /**
   * Resample eg 5m candle sticks into 15m or other minutes
   *
   * @returns number
   * @param period
   */
  convertPeriodToMinute: function(period) {
    const unit = period.slice(-1).toLowerCase();

    switch (unit) {
      case 'm':
        return parseInt(period.substring(0, period.length - 1));
      case 'h':
        return parseInt(period.substring(0, period.length - 1) * 60);
      case 'd':
        return parseInt(period.substring(0, period.length - 1) * 60 * 24);
      case 'w':
        return parseInt(period.substring(0, period.length - 1) * 60 * 24 * 7);
      case 'y':
        return parseInt(period.substring(0, period.length - 1) * 60 * 24 * 7 * 356);
      default:
        throw `Unsupported period unit: ${period}`;
    }
  },

  convertMinuteToPeriod: function(period) {
    if (period < 60) {
      return `${period}m`;
    }

    if (period >= 60) {
      return `${period / 60}h`;
    }

    throw `Unsupported period: ${period}`;
  }
};
