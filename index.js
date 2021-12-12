const program = require('commander');
const TradeCommand = require('./src/command/trade.js');
const ServerCommand = require('./src/command/server.js');
const Backfill = require('./src/command/backfill.js');

// init
const services = require('./src/modules/services');

program
  .command('trade')
  .description('start crypto trading bot')
  .option('-i, --instance <file>', 'Instance to start', 'instance.json')
  .action(async options => {
    await services.boot(__dirname);

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
      throw new Error('Not all options are given');
    }

    await services.boot(__dirname);

    const cmd = new Backfill();
    await cmd.execute(options.exchange, options.symbol, options.period, options.date);

    process.exit();
  });

program
  .command('server')
  .description('')
  .option('-i, --instance <file>', 'Instance to start', 'instance.json')
  .action(options => {
    const cmd = new ServerCommand(options.instance);
    cmd.execute();
  });

program.parse(process.argv);
