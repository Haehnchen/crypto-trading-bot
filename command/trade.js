'use strict';

let services = require('../modules/services')

module.exports = class TradeCommand {
    constructor() {
    }

    execute() {
        services.createTradeInstance().start()
        services.createWebserverInstance().start()
    }
};