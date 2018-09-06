'use strict';

let BackTestCommand = require('./command/backtest.js');
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

program
    .command('backtest')
    .description('upload a file')
    .option('-s, --symbol <symbol>', 'Symbol: bitfinex.BTC-USD', 'bitfinex.BTC-USD')
    .option('-p, --period <period>', 'period: 1m, 5m, 15m, 1h', '15m')
    .action(function(options) {
        let s = options.symbol.split('.');

        let exchange = s[0]
        var symbol = s[1].split('-')

        let cmd = new BackTestCommand(exchange, symbol[0], symbol[1], options.period);
        cmd.execute();
    });

program.parse(process.argv);
