'use strict';

module.exports = class {
    getName() {
        return 'obv_pump_dump'
    }

    buildIndicator(indicatorBuilder, options) {
        indicatorBuilder.add('obv', 'obv', '1m')

        indicatorBuilder.add('ema', 'ema', '1m', {
            'length': 200,
        })
    }

    period(indicatorPeriod, options) {
        let triggerMultiplier = options['trigger_multiplier'] || 2
        let triggerTimeWindows = options['trigger_time_windows'] || 3

        return new Promise((resolve) => {
            let obv = indicatorPeriod.getIndicator('obv')

            if (obv.length <= 20) {
                resolve()
                return
            }

            let price = indicatorPeriod.getPrice()

            let ema = indicatorPeriod.getIndicator('ema').slice(-1)[0];

            let result = {
                'debug': {
                    'obv': obv.slice(-1)[0],
                    'ema': ema,
                }
            }

            if (price > ema) {
                // long
                result['debug']['trend'] = 'up'

                var before = obv.slice(-20, triggerTimeWindows * -1)

                let highest = before.sort((a, b) => b - a).slice(0, triggerTimeWindows)
                let highestOverage = highest.reduce((a, b) => a + b, 0) / highest.length

                let current = obv.slice(triggerTimeWindows * -1)

                let currentAverage = current.reduce((a, b) => a + b, 0) / current.length

                result['debug']['highest_overage'] = highestOverage
                result['debug']['current_average'] = currentAverage

                if (currentAverage < highestOverage) {
                    resolve(result)
                    return
                }

                let difference = Math.abs(currentAverage / highestOverage)

                result['debug']['difference'] = difference

                if(difference >= triggerMultiplier) {
                    result['signal'] = 'long'
                }
            } else {
                // short
                result['debug']['trend'] = 'down'
            }

            resolve(result)
        })
    }
}
