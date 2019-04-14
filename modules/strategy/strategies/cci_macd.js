'use strict';

let SignalResult = require('../dict/signal_result')
const TA = require('../../../utils/technical_analysis')

module.exports = class {
    getName() {
        return 'cci_macd'
    }

    buildIndicator(indicatorBuilder, options) {
        indicatorBuilder.add('cci', 'cci', options['period'], {
            'length': 40,
        })

        indicatorBuilder.add('adx', 'adx', options['period'])

        indicatorBuilder.add('macd', 'macd', options['period'], {
            'fast_length': 12 * 2,
            'slow_length': 26 * 2,
            'signal_length': 9 * 2,
        })

        indicatorBuilder.add('sma', 'sma', '15m', {
            'length': 400,
        })
    }

    async period(indicatorPeriod, options) {
        let currentValues = indicatorPeriod.getLatestIndicators()

        let result = SignalResult.createEmptySignal(currentValues);

        // which direction is allowed here
        let allowedSignal = 'unknown'
        if (currentValues.sma) {
            allowedSignal = indicatorPeriod.getPrice() > currentValues.sma ? 'long' : 'short'
        }

        result.addDebug('direction', allowedSignal)

        // no signal
        let currentSignal = this.macdCciSignalTrigger(indicatorPeriod, result, options)
        if (!currentSignal) {
            return result
        }

        // open position
        let lastSignal = indicatorPeriod.getLastSignal()
        if (!lastSignal) {
            // open position in allowed direction
            if (currentValues.sma && !this.isSideways(indicatorPeriod)) {
                let allowedSignal = indicatorPeriod.getPrice() > currentValues.sma ? 'long' : 'short'
                if (allowedSignal === currentSignal) {
                    result.setSignal(currentSignal)
                }
            }
        } else {
            if (
                (lastSignal === 'long' && currentSignal === 'short') || // close long
                (lastSignal === 'short' && currentSignal === 'long') // close short
            ) {
                result.setSignal('close')
                return result
            }
        }

        return result
    }

    isSideways(indicatorPeriod) {
        for (let value of indicatorPeriod.visitLatestIndicators(10)) {
            if (value.adx > 25) {
                return false
            }
        }

        return true
    }

    macdCciSignalTrigger(indicatorPeriod, result, options) {
        let macdLooback = indicatorPeriod.getIndicator('macd')

        let macdPivotReversal = options['macd_pivot_reversal'] || 5
        let cciTrigger = options['cci_trigger'] || 150

        let macdPivot = TA.getPivotPoints(macdLooback.slice(macdPivotReversal * -3).map(macd => macd.histogram), macdPivotReversal, macdPivotReversal);
        if (!macdPivot) {
            return;
        }

        result.addDebug('macd_pivot', macdPivot)

        if (macdPivot.high && macdPivot.high > 0) {
            for (let value of indicatorPeriod.visitLatestIndicators(options['cci_cross_lookback_for_macd_trigger'])) {

                if (value.cci >= cciTrigger) {
                    result.addDebug('hint', 'success')

                    return 'short'
                }
            }
        }

        if (macdPivot.low && macdPivot.low < 0) {
            for (let value of indicatorPeriod.visitLatestIndicators(options['cci_cross_lookback_for_macd_trigger'])) {
                if (value.cci <= -cciTrigger) {
                    result.addDebug('hint', 'danger')
                    return 'long'
                }
            }
        }
    }

    getBacktestColumns() {
        return [
            {
                'label': 'cci',
                'value': 'cci',
                'type': 'oscillator',
                'range': [150, -150],
            },
            {
                'label': 'macd',
                'value': 'macd.histogram',
            },
            {
                'label': 'macd_pivot',
                'value': 'macd_pivot',
            },
            {
                'label': 'hint',
                'value': 'hint',
                'type': 'icon',
            },
            {
                'label': 'direction',
                'value': 'direction',
            },
            {
                'label': 'adx',
                'value': 'adx',

            },
        ]
    }

    getOptions() {
        return {
            'period': '15m',
            'macd_pivot_reversal': 5,
            'cci_trigger': 150,
            'cci_cross_lookback_for_macd_trigger': 12,
        }
    }
}
