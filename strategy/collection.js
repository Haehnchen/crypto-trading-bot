const ta = require('../utils/technical_analysis');

module.exports = {
    cci: (fastEma, slowEma, cci) => {
        return new Promise((resolve) => {
            (async () => {
                let long = fastEma.slice(-1)[0] > slowEma.slice(-1)[0]
                if (long) {
                    // long

                    let before = cci.slice(-2)[0]
                    let last = cci.slice(-1)[0]

                    if(before <= -200 && last >= -200) {
                        resolve({
                            'signal': 'long'
                        })
                    }
                } else {
                    // short

                    let before = cci.slice(-2)[0]
                    let last = cci.slice(-1)[0]

                    if(before >= 200 && last <= 200) {
                        resolve({
                            'signal': 'short'
                        })
                    }
                }

                resolve()
            })()
        })
    },

    macd: (price, sma200, macd) => {

        return new Promise((resolve) => {
            (async () => {
                let before = macd.slice(-2)[0].histogram
                let last = macd.slice(-1)[0].histogram

                let long = price >= sma200.slice(-1)[0]

                if (long) {
                    // long
                    if(before < 0 && last > 0) {
                        resolve({
                            'signal': 'long',
                        })
                    }
                } else {
                    // short

                    if(before > 0 && last < 0) {
                        resolve({
                            'signal': 'short',
                        })
                    }
                }

                resolve()
            })()
        })
    },
}


