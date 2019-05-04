'use strict';

const SD = require('technicalindicators').SD
const TA = require('../../../utils/technical_analysis')

let SignalResult = require('../dict/signal_result')

module.exports = class {
    getName() {
        return 'noop'
    }

    buildIndicator(indicatorBuilder, options) {
        indicatorBuilder.add('bb', 'bb', '15m')
        indicatorBuilder.add('rsi', 'rsi', '15m')
        indicatorBuilder.add('mfi', 'mfi', '15m')
        indicatorBuilder.add('volume_by_price', 'volume_by_price', '15m')
        indicatorBuilder.add('zigzag', 'zigzag', '15m')

        indicatorBuilder.add('pivot_points_high_low', 'pivot_points_high_low', '15m', {
            'left': 14,
            'right': 14,
        })

        indicatorBuilder.add('sma200', 'sma', '15m', {
            'length': 200,
        })

        indicatorBuilder.add('sma50', 'sma', '15m', {
            'length': 50,
        })

        indicatorBuilder.add('foreign_candle', 'candles', options['foreign_pair_period'] || '15m', {
            'exchange': options['foreign_pair_exchange'] || 'binance',
            'symbol': options['foreign_pair_symbol'] || 'BTCUSDT',
        })
    }

    async period(indicatorPeriod, options) {
        let currentValues = indicatorPeriod.getLatestIndicators()

        let bollinger = indicatorPeriod.getIndicator('bb')

        if (bollinger && currentValues.bb) {
            let standardDeviation = SD.calculate({
                period : 150,
                values : bollinger.slice(-200).map(b => b.width),
            })

            currentValues.bb.sd = standardDeviation.slice(-1)[0]
        }

        let currentBB = indicatorPeriod.getLatestIndicator('bb')
        if (currentBB && currentValues.bb) {
            currentValues.bb.percent = TA.getBollingerBandPercent(indicatorPeriod.getPrice(), currentBB.upper, currentBB.lower)
        }

        let intl = new Intl.NumberFormat('en-US', { minimumSignificantDigits: 3, maximumSignificantDigits: 4})

        let currentValue = currentValues['volume_by_price'];
        currentValues['ranges'] = currentValue
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 3)
            .map(v => intl.format(v.low) + '-' + intl.format(v.high) + ' ' + intl.format(v.volume))
            .join(', ')

        return SignalResult.createEmptySignal(currentValues)
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
            {
                'label': 'Pivot Points',
                'value': 'pivot_points_high_low',
            },
            {
                'label': 'Foreign',
                'value': 'foreign_candle.close',
            },
            {
                'label': 'Ranges (Volume)',
                'value': 'ranges',
            },
            {
                'label': 'zigzag',
                'value': row => row.zigzag && row.zigzag.turningPoint === true ? 'warning' : undefined,
                'type': 'icon',
            },
        ]
    }

    getOptions() {
        return {
            'period': '15m',
            'foreign_pair_exchange': 'binance',
            'foreign_pair_symbol': 'BTCUSDT',
            'foreign_pair_period': '15m',
        }
    }
}
