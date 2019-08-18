'use strict';

let resample = require('../../utils/resample');
let ExchangeCandlestick = require('../../dict/exchange_candlestick');

module.exports = class CandlestickResample {
    constructor(candlestickRepository, candleImporter) {
        this.candlestickRepository = candlestickRepository;
        this.candleImporter = candleImporter;
    }

    /**
     * Resample a eg "15m" range to a "1h"
     *
     * @param exchange The change name to resample
     * @param symbol Pair for resample
     * @param periodFrom From "5m" must be lower then "periodTo"
     * @param periodTo To new candles eg "1h"
     * @param limitCandles For mass resample history provide a switch else calculate the candle window on resample periods
     * @returns {Promise<void>}
     */
    async resample(exchange, symbol, periodFrom, periodTo, limitCandles = false) {
        let toMinute = resample.convertPeriodToMinute(periodTo);
        let fromMinute = resample.convertPeriodToMinute(periodFrom);

        if (fromMinute > toMinute) {
            throw 'Invalid resample "from" must be geater then "to"';
        }

        // we need some
        let wantCandlesticks = 750;

        // we can limit the candles in the range we should resample
        // but for mass resample history provide a switch
        if (limitCandles === true) {
            wantCandlesticks = Math.round(toMinute / fromMinute * 5.6);
        }

        let candlestick = await this.candlestickRepository.getLookbacksForPair(exchange, symbol, periodFrom, wantCandlesticks);
        if (candlestick.length === 0) {
            return
        }

        let resampleCandlesticks = resample.resampleMinutes(candlestick, toMinute);

        let candles = resampleCandlesticks.map(candle => {
            return new ExchangeCandlestick(
                exchange,
                symbol,
                periodTo,
                candle.time,
                candle.open,
                candle.high,
                candle.low,
                candle.close,
                candle.volume,
            );
        });

        await this.candleImporter.insertThrottledCandles(candles);
    }
};
