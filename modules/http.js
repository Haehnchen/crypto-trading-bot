'use strict';

let sqlite3 = require('sqlite3').verbose();
let TransactionDatabase = require("sqlite3-transactions").TransactionDatabase;
let events = require('events')
let fs = require('fs');
let Bitfinex = require('../exchange/bitfinex.js');
let Bitmex = require('../exchange/bitmex.js');
const express = require('express')

module.exports = class Http {
    constructor(instance, config) {
        this.instance = instance
        this.config = config
    }

    execute() {

        let Twig = require("twig"),
            express = require('express'),
            app = express();

        app.set("twig options", {
            allow_async: true, // Allow asynchronous compiling
            strict_variables: false
        });

        app.get('/', function(req, res){
            res.render('../templates/base.html.twig', {
                message : "Hello World"
            });
        });

        app.listen(8080);
    }
};