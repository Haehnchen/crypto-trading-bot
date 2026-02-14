import { Command } from 'commander';
import { TradeCommand } from './src/command/trade';
import { ServerCommand } from './src/command/server';
import { BackfillCommand } from './src/command/backfill';
import services from './src/modules/services';

const program = new Command();

// Use process.cwd() instead of __dirname for compiled JS compatibility
const projectDir = process.cwd();

program
  .command('trade')
  .description('start crypto trading bot')
  .option('-i, --instance <file>', 'Instance to start', 'instance.json')
  .action(async (options: any) => {
    await services.boot(projectDir);

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

    await services.boot(projectDir);

    const cmd = new BackfillCommand();
    await cmd.execute(options.exchange, options.symbol, options.period, options.date);

    process.exit();
  });

program
  .command('backtest')
  .description('run a strategy backtest and output signals')
  .requiredOption('-s, --strategy <strategy>', 'strategy name (e.g., dca_dipper)')
  .requiredOption('--pair <pair>', 'trading pair (format: exchange.symbol, e.g., binance.BTCUSDT)')
  .option('-p, --period <period>', 'candle period (1m, 5m, 15m, 1h, etc.)', '15m')
  .option('--hours <hours>', 'hours of historical data', '168')
  .action(async (options: any) => {
    await services.boot(projectDir);

    const { strategy, pair, period, hours } = options;

    const cmd = services.getBacktestCommand();
    await cmd.execute(strategy, pair, period, hours);

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
