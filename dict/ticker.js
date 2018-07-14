'use strict';

module.exports = class Ticker {
    constructor(time, bid, ask) {
        this.time = time;
        this.bid = bid;
        this.ask = ask;
    }
};