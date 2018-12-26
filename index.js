'use strict';

let TradeCommand = require('./command/trade.js');
let ServerCommand = require('./command/server.js');
let Backfill = require('./command/backfill.js');

let program = require('commander');

// init
let services = require('./modules/services')

program
    .command('trade')
    .description('upload a file')
    .option('-i, --instance <file>', 'Instance to start', 'instance.json')
    .action(function(options) {
        services.boot()

        let cmd = new TradeCommand(options.instance);
        cmd.execute();
    });

program
    .command('backfill')
    .description('upload a file')
    .option('-e, --exchange <exchange>')
    .option('-s, --symbol <symbol>')
    .option('-p, --period <period>', '1m 5m, 15m, 1h', '15m')
    .option('-d, --date <date>', 'days in past to collect start', '7')
    .action(function(options) {
        if (!options.exchange || !options.symbol || !options.period || !options.date) {
            throw 'Not all options are given'
        }

        services.boot()

        let cmd = new Backfill();
        cmd.execute(options.exchange, options.symbol, options.period, options.date);
    });

program
    .command('server')
    .option('-i, --instance <file>', 'Instance to start', 'instance.json')
    .action(function(options) {
        let cmd = new ServerCommand(options.instance);
        cmd.execute();
    });

program.parse(process.argv);
