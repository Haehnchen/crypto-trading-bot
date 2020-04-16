module.exports = {
  /**
   * ZigZag indicator
   *
   * @see https://github.com/andresilvasantos/bitprophet/blob/master/indicators.js
   *
   * @param ticks
   * @param deviation
   * @param arraySize
   * @returns {Array}
   */
  zigzag: function(ticks, deviation = 5, arraySize = -1) {
    // Determines percent deviation in price changes, presenting frequency and volatility in deviation. Also helps determine trend reversals.
    // Read more: http://stockcharts.com/school/doku.php?id=chart_school:technical_indicators:zigzag
    // arraySize = -1, calculate ZigZag for all ticks
    // arraySize = n, where n >= 1, calculate the ZigZag for the last n ticks

    const turningPoints = [];
    let basePrice = -1;
    let lastDeviation = 0;
    deviation /= 100;

    const startingTick = arraySize == -1 ? 0 : ticks.length - arraySize;
    // Calculate all turning points that have a deviation equal or superior to the argument received
    for (var i = startingTick; i < ticks.length; ++i) {
      const close = parseFloat(ticks[i].close);
      const high = parseFloat(ticks[i].high);
      const low = parseFloat(ticks[i].low);
      let positiveDeviation = high / basePrice - 1;
      let negativeDeviation = low / basePrice - 1;

      if (basePrice == -1) {
        basePrice = close;
        lastDeviation = 0;
        turningPoints.push({ timePeriod: i, value: close, deviation: lastDeviation });
        continue;
      }

      // Is it a positive turning point or is it higher than the last positive one?
      if (positiveDeviation >= deviation || (positiveDeviation > 0 && lastDeviation > 0)) {
        if (lastDeviation > 0) {
          positiveDeviation += lastDeviation;
          turningPoints.pop();
        }

        turningPoints.push({ timePeriod: i, value: high, deviation: positiveDeviation });
        lastDeviation = positiveDeviation;
        basePrice = high;
      }
      // Is it a positive turning point or is it lower than the last negative one?
      else if (negativeDeviation <= -deviation || (negativeDeviation < 0 && lastDeviation < 0)) {
        if (lastDeviation < 0) {
          negativeDeviation += lastDeviation;
          turningPoints.pop();
        }

        turningPoints.push({ timePeriod: i, value: low, deviation: negativeDeviation });
        lastDeviation = negativeDeviation;
        basePrice = low;
      }
      // Add always the last one as a turning point, just to make our life easier for the next calculation
      else if (i == ticks.length - 1) {
        if (positiveDeviation > 0) turningPoints.push({ timePeriod: i, value: high, deviation: positiveDeviation });
        else turningPoints.push({ timePeriod: i, value: low, deviation: negativeDeviation });
      }
    }

    const zigzag = [];
    // Add the turning points to the returning array, calculate the values between those turning points and add them as well
    for (i = 0; i < turningPoints.length; ++i) {
      const turningPoint = turningPoints[i];
      zigzag.push({
        timePeriod: turningPoint.timePeriod,
        value: turningPoint.value,
        deviation: parseFloat((turningPoint.deviation * 100).toFixed(2)),
        turningPoint: turningPoint.deviation > deviation || turningPoint.deviation < -deviation
      });

      if (turningPoint.timePeriod >= ticks.length - 1) continue;

      const nextTurningPoint = turningPoints[i + 1];
      for (let j = turningPoint.timePeriod + 1; j < nextTurningPoint.timePeriod; ++j) {
        const distanceToTP = j - turningPoint.timePeriod;
        const distanceTPs = nextTurningPoint.timePeriod - turningPoint.timePeriod;
        const value = turningPoint.value + ((nextTurningPoint.value - turningPoint.value) / distanceTPs) * distanceToTP;
        const currentDeviation = value / turningPoint.value;

        zigzag.push({
          timePeriod: j,
          value: value,
          deviation: parseFloat((currentDeviation * 100).toFixed(2)),
          turningPoint: false
        });
      }
    }

    return zigzag;
  }
};
