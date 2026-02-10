import _ from 'lodash';
import { InstancesConfig } from './pair_config';
import { ExchangeManager } from '../exchange/exchange_manager';

export interface SymbolInstance {
  exchange: string;
  symbol: string;
  trade?: {
    capital?: number;
    currency_capital?: number;
    balance_percent?: number;
    strategies?: any[];
  };
  strategies?: any[];
  watchdogs?: string[];
}

export interface TradePairItem {
  exchange: string;
  symbol: string;
  watchdogs?: string[];
  is_trading: boolean;
  has_position: boolean;
  trade_capital: number;
  trade_currency_capital: number;
  trade_balance_percent: number;
  strategies: any[];
  strategies_trade: any[];
  weight: number;
  strategy_names: string[];
  process?: string;
}

export class PairsHttp {
  private instances: InstancesConfig;
  private exchangeManager: ExchangeManager;
  private pairStateManager: any;
  private eventEmitter: any;

  constructor(
    instances: InstancesConfig,
    exchangeManager: ExchangeManager,
    pairStateManager: any,
    eventEmitter: any
  ) {
    this.instances = instances;
    this.exchangeManager = exchangeManager;
    this.pairStateManager = pairStateManager;
    this.eventEmitter = eventEmitter;
  }

  async getTradePairs(): Promise<TradePairItem[]> {
    const pairs = await Promise.all(
      this.instances.symbols.map(async (symbol: SymbolInstance) => {
        const position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol);
        const state = await this.pairStateManager.get(symbol.exchange, symbol.symbol);

        const strategiesTrade = symbol.trade && symbol.trade.strategies ? symbol.trade.strategies : [];
        const strategies = symbol.strategies || [];

        const tradeCapital = _.get(symbol, 'trade.capital', 0);
        const tradeCurrencyCapital = _.get(symbol, 'trade.currency_capital', 0);
        const tradeBalancePercent = _.get(symbol, 'trade.balance_percent', 0);

        const item: TradePairItem = {
          exchange: symbol.exchange,
          symbol: symbol.symbol,
          watchdogs: symbol.watchdogs,
          is_trading:
            strategiesTrade.length > 0 || tradeCapital > 0 || tradeCurrencyCapital > 0 || tradeBalancePercent > 0,
          has_position: position !== undefined,
          trade_capital: tradeCapital,
          trade_currency_capital: tradeCurrencyCapital,
          trade_balance_percent: tradeBalancePercent,
          strategies: strategies,
          strategies_trade: strategiesTrade,
          weight: 0,
          strategy_names: [...strategies, ...strategiesTrade].map((s: any) => s.strategy)
        };

        // open position wins over default state
        if (item.has_position) {
          item.weight += 1;
        }

        // processing items must win
        if (state && state.state) {
          item.process = state.state;
          item.weight += 2;
        }

        return item;
      })
    );

    return pairs
      .sort((a, b) => `${a.exchange}.${a.symbol}`.localeCompare(`${b.exchange}.${b.symbol}`))
      .sort((a, b) => b.weight - a.weight);
  }

  async triggerOrder(exchangeName: string, symbol: string, action: string): Promise<void> {
    let side = action;
    const options: Record<string, any> = {};
    if (['long_market', 'short_market', 'close_market'].includes(action)) {
      options.market = true;
      side = side.replace('_market', '');
    }

    this.pairStateManager.update(exchangeName, symbol, side, options);

    this.eventEmitter.emit('tick_ordering');
  }
}
