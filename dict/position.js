'use strict';

module.exports = class Order {
    constructor(side, price, amount) {
        this.side = side;
        this.price = price;
        this.amount = amount;
    }
};