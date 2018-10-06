'use strict';

let TradeCommand = require('./command/trade.js');
let ServerCommand = require('./command/server.js');

let program = require('commander');

// init
let services = require('./modules/services')
services.boot()

program
    .command('trade')
    .description('upload a file')
    .option('-i, --instance <file>', 'Instance to start', 'instance.json')
    .action(function(options) {
        let cmd = new TradeCommand(options.instance);
        cmd.execute();
    });

program
    .command('server')
    .option('-i, --instance <file>', 'Instance to start', 'instance.json')
    .action(function(options) {
        let cmd = new ServerCommand(options.instance);
        cmd.execute();
    });

program.parse(process.argv);
