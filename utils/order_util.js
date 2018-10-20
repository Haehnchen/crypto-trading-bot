let Order = require('../dict/order');

module.exports = {
    calculateOrderAmount: (price, capital) => {
        return capital / price
    },

    syncStopLossOrder: (position, orders) => {
        if (orders.filter(order => order.type === 'stop').length === 0) {
            return [
                {
                    'amount': position.amount,
                },
            ]
        }

        let stopOrder = orders.find(order => order.type === 'stop')

        let difference = Math.abs(position.amount) - Math.abs(stopOrder.amount)

        if (difference !== 0) {
            return [
                {
                    'id': stopOrder.id,
                    'amount': position.amount,
                },
            ]
        }

        return []
    },

    caluclateIncrementSize: (num, tickSize) => {
        let number = Math.round(num / tickSize) * tickSize

        // fix float issues:
        // 0.0085696 => 0.00001 = 0.00857000...001
        let points = tickSize.toString().split('.')
        if (points.length < 2) {
            return number
        }

        return number.toFixed(points[1].length)
    }
}
