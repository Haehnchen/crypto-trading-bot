// https://www.mql5.com/en/forum/197614

const ta = require('../utils/technical_analysis');
const moment = require('moment')

module.exports = {
    onPeriod: function (lookbacks, cb) {
        ta.getIndicatorsForCandleLookbackPeriod(lookbacks, (result) => {
            cb([
                moment(lookbacks[0].time * 1000).format(),
                'debug: ' + JSON.stringify(result),
            ])
        })
    },
}


