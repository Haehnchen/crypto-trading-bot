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
}
