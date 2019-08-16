'use strict';

let SignalResult = require('../dict/signal_result')
const SD = require('technicalindicators').SD
const SMA = require('technicalindicators').SMA
const TA = require('../../../utils/technical_analysis')
const TechnicalPattern = require('../../../utils/technical_pattern')
let resample = require('../../../utils/resample')
let TechnicalAnalysis = require('../../../utils/technical_analysis')
let Lowest = require('technicalindicators').Lowest;
let isTrendingUp = require('technicalindicators').isTrendingUp;
let isTrendingDown = require('technicalindicators').isTrendingDown;

module.exports = class {
    getName() {
        return 'trader'
    }

    buildIndicator(indicatorBuilder, options) {
        indicatorBuilder.add('candles_1m', 'candles', '1m')
        indicatorBuilder.add('bb', 'bb', '15m', {
            'length': 40,
        })
    }

    async period(indicatorPeriod, options) {
        let currentValues = indicatorPeriod.getLatestIndicators()

        let result = SignalResult.createEmptySignal(currentValues);

        let candles1m = indicatorPeriod.getIndicator('candles_1m')
        if(!candles1m) {
            return result
        }

        let candles3m = resample.resampleMinutes(candles1m.slice().reverse(), '3')

        let foo = TechnicalAnalysis.getPivotPoints(candles1m.slice(-10).map(c => c.close), 3, 3)

        let bb = indicatorPeriod.getLatestIndicator('bb')

        let lastCandle = candles1m.slice(-1)[0]
        result.addDebug('price2', lastCandle.close);

        if (bb && lastCandle && lastCandle.close > bb.upper) {
            result.addDebug('v', 'success');

            let bb = indicatorPeriod.getIndicator('bb')

            let values = bb.slice(-10).reverse().map(b => b.width);
            let value = Math.min(...values);

            if (currentValues.bb.width < 0.05) {
                result.addDebug('x', currentValues.bb.width);
                result.setSignal('long')
            }
        }

        result.addDebug('pivot', foo);

        result.mergeDebug(TechnicalPattern.volumePump(candles3m.slice().reverse() || []))

        return result
    }

    getBacktestColumns() {
        return [
            {
                'label': 'price2',
                'value': 'price2',
            },
            {
                'label': 'RSI',
                'value': 'rsi',
            },
            {
                'label': 'roc',
                'value': 'roc_1m',
            },
            {
                'label': 'roc_ma',
                'value': 'roc_ma',
                'type': 'icon',
            },
            {
                'label': 'Vol',
                'value': 'candles_1m.volume',
            },
            {
                'label': 'VolSd',
                'value': 'volume_sd',
            },
            {
                'label': 'VolV',
                'value': 'volume_v',
            },
            {
                'label': 'hint',
                'value': 'hint',
                'type': 'icon',
            },
            {
                'label': 'v',
                'value': 'v',
                'type': 'icon',
            },
            {
                'label': 'x',
                'value': 'x',
            },
            {
                'label': 'pivot',
                'value': 'pivot',
            },
        ]
    }

    getOptions() {
        return {
            'period': '15m',
        }
    }
}
