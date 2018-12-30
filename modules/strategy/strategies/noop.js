'use strict';

const SD = require('technicalindicators').SD
const TA = require('../../../utils/technical_analysis')

module.exports = class {
    getName() {
        return 'noop'
    }

    buildIndicator(indicatorBuilder, options) {
        indicatorBuilder.add('bb', 'bb', '15m')
        indicatorBuilder.add('rsi', 'rsi', '15m')
        indicatorBuilder.add('mfi', 'mfi', '15m')

        indicatorBuilder.add('sma200', 'sma', '15m', {
            'length': 200,
        })

        indicatorBuilder.add('sma50', 'sma', '15m', {
            'length': 50,
        })
    }

    period(indicatorPeriod, options) {
        return new Promise((resolve) => {
            let debug = {}

            let bb = indicatorPeriod.getIndicator('bb')
            let currentBB = bb.slice(-1)[0]

            debug['bb'] = currentBB
            debug['rsi'] = indicatorPeriod.getIndicator('rsi').slice(-1)[0]
            debug['mfi'] = indicatorPeriod.getIndicator('mfi').slice(-1)[0]
            debug['sma200'] = indicatorPeriod.getIndicator('sma200').slice(-1)[0]
            debug['sma50'] = indicatorPeriod.getIndicator('sma50').slice(-1)[0]

            let standardDeviation = SD.calculate({
                period : 150,
                values : bb.slice(-200).map(b => b.width),
            })

            debug.bb.sd = standardDeviation.slice(-1)[0]
            debug.bb.percent = TA.getBollingerBandPercent(indicatorPeriod.getPrice(), currentBB.upper, currentBB.lower)

            resolve({'debug': debug})
        })
    }

    getBacktestColumns() {
        return [
            {
                'label': 'BollDev',
                'value': 'bb.width',
                'type': 'cross',
                'cross': 'bb.sd',
            },
            {
                'label': 'BollPct',
                'value': 'bb.percent',
                'type': 'oscillator',
                'range': [1, 0],
            },
            {
                'label': 'rsi',
                'value': 'rsi',
                'type': 'oscillator',
            },
            {
                'label': 'mfi',
                'value': 'mfi',
                'type': 'oscillator',
            },
            {
                'label': 'SMA 50/200',
                'value': 'sma50',
                'type': 'cross',
                'cross': 'sma200',
            },
        ]
    }
}
