'use strict';

module.exports = class Position {
    /**
     * @param symbol 'BTCUSD'
     * @param side "long" or "short"
     * @param amount negative for short and positive for long entries
     * @param profit Current profit in percent: "23.56"
     * @param updatedAt Item last found or sync
     * @param entry The entry price
     */
    constructor(symbol, side, amount, profit, updatedAt, entry) {
        if (side !== 'long' && side !== 'short') {
            throw 'Invalid position direction given:' + side
        }

        if (amount < 0 && side === 'long') {
            throw 'Invalid direction:' + side
        }

        if (amount > 0 && side === 'short') {
            throw 'Invalid direction:' + side
        }

        this.symbol = symbol
        this.side = side
        this.amount = amount
        this.profit = profit
        this.updatedAt = updatedAt
        this.entry = entry
    }
};