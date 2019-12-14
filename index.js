const program = require('commander');
const TradeCommand = require('./command/trade.js');
const ServerCommand = require('./command/server.js');
const Backfill = require('./command/backfill.js');

// init
const services = require('./modules/services');

program
  .command('trade')
  .description('start crypto trading bot')
  .option('-i, --instance <file>', 'Instance to start', 'instance.json')
  .action(async options => {
    await services.boot();

    const cmd = new TradeCommand(options.instance);
    cmd.execute();
  });

program
  .command('backfill')
  .description('process historical data collection')
  .option('-e, --exchange <exchange>')
  .option('-s, --symbol <symbol>')
  .option('-p, --period <period>', '1m 5m, 15m, 1h', '15m')
  .option('-d, --date <date>', 'days in past to collect start', '7')
  .action(async options => {
    if (!options.exchange || !options.symbol || !options.period || !options.date) {
      throw 'Not all options are given';
    }

    await services.boot();

    const cmd = new Backfill();
    await cmd.execute(options.exchange, options.symbol, options.period, options.date);

    process.exit();
  });

program
  .command('server')
  .description('')
  .option('-i, --instance <file>', 'Instance to start', 'instance.json')
  .action(function(options) {
    const cmd = new ServerCommand(options.instance);
    cmd.execute();
  });

program.parse(process.argv);
