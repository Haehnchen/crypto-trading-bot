'use strict';

let resample = require('../../utils/resample')
let CandlestickEvent = require('../../event/candlestick_event')

module.exports = class CandlestickResample {
    constructor(candlestickRepository, eventEmitter) {
        this.candlestickRepository = candlestickRepository
        this.eventEmitter = eventEmitter
    }

    async resample(exchange, symbol, periodFrom, periodTo) {
        let candlestick = await this.candlestickRepository.getLookbacksForPair(exchange, symbol, periodFrom)
        if(candlestick.length === 0) {
            return
        }

        let resampleCandlesticks = resample.resampleMinutes(candlestick, resample.convertPeriodToMinute(periodTo))

        this.eventEmitter.emit('candlestick', new CandlestickEvent(exchange, symbol, periodTo, resampleCandlesticks))
    }
}
