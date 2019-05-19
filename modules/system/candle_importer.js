'use strict';

let _ = require('lodash')

module.exports = class CandleImporter {
    constructor(candlestickRepository) {
        this.candlestickRepository = candlestickRepository
        this.trottle = {}

        setInterval(async () => {
            let candles = Object.values(this.trottle)
            this.trottle = {}

            // on init we can have a lot or REST api we can have a lot of candles
            // reduce database locking time by split them
            if (candles.length > 0) {
                for (let chunk of _.chunk(candles, 1000)) {
                    await this.insertCandles(chunk)
                }
            }

        }, 1000 * 5)
    }

    async insertCandles(candles) {
        return this.candlestickRepository.insertCandles(candles)
    }

    /**
     * We have spikes in each exchange on possible every full minute, collect them for a time range the candles and fire them at once
     *
     * @param candles
     * @returns {Promise<void>}
     */
    async insertThrottledCandles(candles) {
        for (let candle of candles) {
            this.trottle[candle.symbol + candle.period + candle.time] = candle
        }
    }
}
