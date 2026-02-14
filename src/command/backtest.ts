import { convertPeriodToMinute } from '../utils/resample';
import { StrategyRegistry } from '../modules/strategy/v2/strategy_registry';
import { ExchangeCandleCombine } from '../modules/exchange/exchange_candle_combine';
import { StrategyExecutor } from '../modules/strategy/v2/typed_backtest';

export class BacktestCommand {
  constructor(
    private readonly strategyRegistry: StrategyRegistry,
    private readonly exchangeCandleCombine: ExchangeCandleCombine,
    private readonly strategyExecutor: StrategyExecutor
  ) {}

  /**
   * Execute backtest
   * @param strategy - Strategy name (built-in or in var/strategies)
   * @param pair - Exchange.Symbol (e.g., "binance.BTCUSDT")
   * @param period - Candle period (e.g., "15m", "1h")
   * @param hours - Number of hours to backtest
   */
  async execute(strategy: string, pair: string, period: string, hours: string): Promise<void> {
    const [exchange, symbol] = pair.split('.');
    const hoursNum = parseInt(hours, 10);

    // Create strategy instance (auto-loads from var/strategies if needed)
    const strategyInstance = this.strategyRegistry.createStrategy(strategy, {});

    // Calculate time range for candle fetch
    const endTime = Math.floor(Date.now() / 1000);
    const startTime = endTime - hoursNum * 3600;
    const prefillTime = startTime - 200 * convertPeriodToMinute(period) * 60;

    // Fetch candles
    const candleData = await this.exchangeCandleCombine.fetchCombinedCandlesSince(
      exchange,
      symbol,
      period,
      [],
      prefillTime
    );

    const candles = candleData[exchange] || [];

    if (candles.length === 0) {
      console.error(`No candles found for ${exchange}:${symbol}:${period}`);
      process.exit(1);
    }

    const candlesAsc = candles.slice().reverse();

    // Execute strategy to get signals
    const rows = await this.strategyExecutor.execute(strategyInstance, candlesAsc);

    // Filter to only rows with signals
    const filteredRows = rows.filter(r => r.signal);

    // Output simple table
    console.log('');
    console.log(`Strategy: ${strategy}`);
    console.log(`Exchange: ${exchange}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Period: ${period}`);
    console.log(`Hours: ${hoursNum}`);
    console.log('');
    console.log('Time                         | Price       | Signal');
    console.log('-----------------------------|-------------|--------');

    for (const row of filteredRows) {
      const time = new Date(row.time * 1000).toISOString().replace('T', ' ').substring(0, 19);
      const price = row.price.toFixed(8).padStart(11);
      const signal = row.signal || '-';
      console.log(`${time} | ${price} | ${signal}`);
    }
  }
}
