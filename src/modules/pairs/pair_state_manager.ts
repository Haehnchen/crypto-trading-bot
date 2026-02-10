import { PairState, PairStateType } from '../../dict/pair_state';
import { OrderCapital } from '../../dict/order_capital';
import { PairInterval } from './pair_interval';

export class PairStateManager {
  private logger: any;
  private pairConfig: any;
  private systemUtil: any;
  private pairStateExecution: any;
  private orderExecutor: any;
  private stats: Record<string, PairState>;
  private pairInterval: PairInterval;

  constructor(logger: any, pairConfig: any, systemUtil: any, pairStateExecution: any, orderExecutor: any, pairInterval?: PairInterval) {
    this.logger = logger;
    this.pairConfig = pairConfig;
    this.systemUtil = systemUtil;
    this.pairStateExecution = pairStateExecution;
    this.orderExecutor = orderExecutor;
    this.stats = {};
    this.pairInterval = pairInterval || new PairInterval();
  }

  update(exchange: string, symbol: string, state: string, options: Record<string, any> = {}): void {
    if (!['long', 'close', 'short', 'cancel'].includes(state)) {
      this.logger.error(`Invalidate state: ${state}`);
      throw new Error(`Invalidate state: ${state}`);
    }

    const clearCallback = () => {
      this.logger.info(`State cleared: ${exchange} - ${symbol} - ${state}`);
      this.clear(exchange, symbol);
    };

    let pairState: PairState;
    if (state === 'long') {
      const capital = this.pairConfig.getSymbolCapital(exchange, symbol);
      if (!(capital instanceof OrderCapital)) {
        this.logger.error(`Invalidate OrderCapital: ${exchange} - ${symbol} - ${state}`);
        return;
      }

      pairState = PairState.createLong(exchange, symbol, capital, options || {}, true, clearCallback);
    } else if (state === 'short') {
      const capital = this.pairConfig.getSymbolCapital(exchange, symbol);
      if (!(capital instanceof OrderCapital)) {
        this.logger.error(`Invalidate OrderCapital: ${exchange} - ${symbol} - ${state}`);
        return;
      }

      pairState = PairState.createShort(exchange, symbol, capital, options || {}, true, clearCallback);
    } else {
      pairState = new PairState(exchange, symbol, state as PairStateType, options || {}, true, clearCallback);
    }

    const stateKey = exchange + symbol;
    this.logger.info(
      `Pair state changed: ${JSON.stringify({
        new: JSON.stringify(pairState),
        old: JSON.stringify(this.stats[stateKey] || {})
      })}`
    );

    this.stats[stateKey] = pairState;

    this.pairInterval.addInterval(stateKey, this.systemUtil.getConfig('tick.ordering', 10800), async () => {
      // prevent race conditions
      if (!pairState.isCleared() && stateKey in this.stats) {
        await this.pairStateExecution.onPairStateExecutionTick(pairState);
      }

      // state: can be cleared only onPairStateExecutionTick
      if (!pairState.isCleared() && pairState.hasAdjustedPrice() && stateKey in this.stats) {
        await this.orderExecutor.adjustOpenOrdersPrice(pairState);
      }
    });
  }

  get(exchange: string, symbol: string): PairState | undefined {
    if (exchange + symbol in this.stats) {
      return this.stats[exchange + symbol];
    }

    return undefined;
  }

  all(): PairState[] {
    const stats: PairState[] = [];

    for (const key in this.stats) {
      stats.push(this.stats[key]);
    }

    return stats;
  }

  clear(exchange: string, symbol: string): void {
    if (exchange + symbol in this.stats) {
      this.logger.debug(`Pair state cleared: ${JSON.stringify(this.stats[exchange + symbol])}`);
      delete this.stats[exchange + symbol];
    }

    this.pairInterval.clearInterval(exchange + symbol);
  }

  getSellingPairs(): PairState[] {
    const pairs: PairState[] = [];

    for (const key in this.stats) {
      if (this.stats[key].state === 'short') {
        pairs.push(this.stats[key]);
      }
    }

    return pairs;
  }

  getBuyingPairs(): PairState[] {
    const pairs: PairState[] = [];

    for (const key in this.stats) {
      if (this.stats[key].state === 'long') {
        pairs.push(this.stats[key]);
      }
    }

    return pairs;
  }

  getClosingPairs(): PairState[] {
    const pairs: PairState[] = [];

    for (const key in this.stats) {
      if (this.stats[key].state === 'close') {
        pairs.push(this.stats[key]);
      }
    }

    return pairs;
  }

  getCancelPairs(): PairState[] {
    const pairs: PairState[] = [];

    for (const key in this.stats) {
      if (this.stats[key].state === 'cancel') {
        pairs.push(this.stats[key]);
      }
    }

    return pairs;
  }

  isNeutral(exchange: string, symbol: string): boolean {
    return !(exchange + symbol in this.stats);
  }

  async onTerminate(): Promise<void> {
    const running = this.all();

    for (const key in running) {
      const pair = running[key];

      this.logger.info(`Terminate: Force managed orders cancel: ${JSON.stringify(pair)}`);
      console.log(`Terminate: Force managed orders cancel: ${JSON.stringify(pair)}`);

      await this.pairStateExecution.onCancelPair(pair);
    }
  }
}
