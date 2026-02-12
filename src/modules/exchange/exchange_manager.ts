import _ from 'lodash';
import { ExchangePosition } from '../../dict/exchange_position';
import { ExchangeOrder } from '../../dict/exchange_order';
import { Position } from '../../dict/position';
import type { Logger } from '../services';

export interface SymbolInstance {
  exchange: string;
  symbol: string;
}

export interface ExchangeInstance {
  getName(): string;
  start(config: any, symbols: SymbolInstance[]): void;
  getPositions(): Promise<Position[]>;
  getPositionForSymbol(symbol: string): Promise<Position | undefined>;
  getOrdersForSymbol(symbol: string): Promise<ExchangeOrder[]>;
  findOrderById(id: string | number): Promise<ExchangeOrder | undefined>;
  updateOrder(id: string | number, order: any): Promise<any>;
  order(order: any): Promise<any>;
  isInverseSymbol(symbol: string): boolean;
  calculateAmount(amount: number, symbol: string): number | undefined;
  calculatePrice(price: number, symbol: string): number | undefined;
  getOrders(): Promise<ExchangeOrder[]>;
  cancelOrder(id: string | number): Promise<any>;
  cancelAll(symbol: string): Promise<any>;
  getTradableBalance?(): number | undefined;
}

export class ExchangeManager {
  private exchanges: ExchangeInstance[] = [];

  constructor(
    private readonly exchangesIterator: ExchangeInstance[],
    private logger: Logger,
    private instances: { symbols: SymbolInstance[] },
    private readonly config: any
  ) {}

  init(): void {
    const exchanges = this.exchangesIterator;

    const symbols: Record<string, SymbolInstance[]> = {};

    exchanges
      .map(exchange => exchange.getName())
      .forEach(exchangeName => {
        const pairs = this.instances.symbols.filter((symbol: SymbolInstance) => {
          return symbol.exchange === exchangeName;
        });

        if (pairs.length === 0) {
          return;
        }

        symbols[exchangeName] = pairs;
      });

    const activeExchanges = exchanges.filter(exchange => exchange.getName() in symbols);

    activeExchanges.forEach((activeExchange: ExchangeInstance) =>
      activeExchange.start(_.get(this.config, `exchanges.${activeExchange.getName()}`, {}), symbols[activeExchange.getName()])
    );

    this.exchanges = activeExchanges;
  }

  all(): ExchangeInstance[] {
    return this.exchanges;
  }

  get(name: string): ExchangeInstance {
    return this.exchanges.find((exchange: ExchangeInstance) => exchange.getName() === name)!;
  }

  async getPosition(exchangeName: string, symbol: string): Promise<Position | undefined> {
    return this.get(exchangeName).getPositionForSymbol(symbol);
  }

  async getPositions(): Promise<ExchangePosition[]> {
    const positions: ExchangePosition[] = [];

    for (const exchange of this.all()) {
      const exchangeName = exchange.getName();

      const exchangePositions = (await exchange.getPositions()).map((pos: Position) => new ExchangePosition(exchangeName, pos));

      positions.push(...exchangePositions);
    }

    return positions;
  }

  async getOrders(exchangeName: string, symbol: string): Promise<ExchangeOrder[]> {
    return this.get(exchangeName).getOrdersForSymbol(symbol);
  }

  async findOrderById(exchangeName: string, id: string): Promise<ExchangeOrder | undefined> {
    return this.get(exchangeName).findOrderById(id);
  }
}
