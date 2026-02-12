import { Command } from 'commander';
import { TradeCommand } from './src/command/trade';
import { ServerCommand } from './src/command/server';
import { BackfillCommand } from './src/command/backfill';
import services from './src/modules/services';

const program = new Command();

program
  .command('trade')
  .description('start crypto trading bot')
  .option('-i, --instance <file>', 'Instance to start', 'instance.json')
  .action(async (options: any) => {
    await services.boot(__dirname);

    const cmd = new TradeCommand();
    cmd.execute();
  });

program
  .command('backfill')
  .description('process historical data collection')
  .option('-e, --exchange <exchange>')
  .option('-s, --symbol <symbol>')
  .option('-p, --period <period>', '1m 5m, 15m, 1h', '15m')
  .option('-d, --date <date>', 'days in past to collect start', '7')
  .action(async (options: any) => {
    if (!options.exchange || !options.symbol || !options.period || !options.date) {
      throw new Error('Not all options are given');
    }

    await services.boot(__dirname);

    const cmd = new BackfillCommand();
    await cmd.execute(options.exchange, options.symbol, options.period, options.date);

    process.exit();
  });

program
  .command('server')
  .description('')
  .option('-i, --instance <file>', 'Instance to start', 'instance.json')
  .action((options: any) => {
    const cmd = new ServerCommand();
    cmd.execute();
  });

program.parse(process.argv);
