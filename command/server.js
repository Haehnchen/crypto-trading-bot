'use strict';

let sqlite3 = require('sqlite3').verbose();
let TransactionDatabase = require("sqlite3-transactions").TransactionDatabase;
let events = require('events')
let fs = require('fs');
let Bitfinex = require('../exchange/bitfinex.js');
let Bitmex = require('../exchange/bitmex.js');
const express = require('express')
let Candlestick = require('./../dict/candlestick.js');
const ta = require('../utils/technical_analysis');
let Ticker = require('../dict/ticker');

let Ta = require('../modules/ta');
let services = require('../modules/services')

module.exports = class ServerCommand {
    constructor() {}

    execute() {
        services.boot()
        services.createWebserver()
    }
};