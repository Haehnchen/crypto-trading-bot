import { Order } from '../../dict/order';
import { ExchangeOrder } from '../../dict/exchange_order';
import { OrderUtil } from '../../utils/order_util';
import { Position } from '../../dict/position';
import type { Logger } from '../services';

export interface RiskRewardOptions {
  stop_percent?: number;
  target_percent?: number;
}

export interface RiskRewardResult {
  stop?: number;
  target?: number;
}

export interface RiskRewardOrder {
  id?: string | number;
  price?: number;
  amount?: number;
  type?: 'stop' | 'target';
}

export class RiskRewardRatioCalculator {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  calculateForOpenPosition(position: Position, options: RiskRewardOptions = { stop_percent: 3, target_percent: 6 }): RiskRewardResult | undefined {
    let entryPrice = position.entry;
    if (!entryPrice) {
      this.logger.info(`Invalid position entryPrice for stop loss:${JSON.stringify(position)}`);
      return undefined;
    }

    const result: RiskRewardResult = {
      stop: undefined,
      target: undefined
    };

    entryPrice = Math.abs(entryPrice);

    if (position.side === 'long') {
      result.target = entryPrice * (1 + (options.target_percent || 0) / 100);
      result.stop = entryPrice * (1 - (options.stop_percent || 0) / 100);
    } else {
      result.target = entryPrice * (1 - (options.target_percent || 0) / 100);
      result.stop = entryPrice * (1 + (options.stop_percent || 0) / 100);
    }

    return result;
  }

  async syncRatioRewardOrders(position: Position, orders: Order[], options: RiskRewardOptions): Promise<Record<string, RiskRewardOrder>> {
    const newOrders: Record<string, RiskRewardOrder> = {};

    const riskRewardRatio = this.calculateForOpenPosition(position, options);

    if (!riskRewardRatio) {
      return newOrders;
    }

    const stopOrders = orders.filter(order => order.type === ExchangeOrder.TYPE_STOP);
    if (stopOrders.length === 0) {
      newOrders.stop = {
        amount: Math.abs(position.amount),
        price: riskRewardRatio.stop
      };

      // inverse price for lose long position via sell
      if (position.side === 'long' && newOrders.stop.price) {
        newOrders.stop.price = newOrders.stop.price * -1;
      }
    } else {
      // update order
      const stopOrder = stopOrders[0];

      // only +1% amount change is important for us
      if (OrderUtil.isPercentDifferentGreaterThen(position.amount, stopOrder.amount, 1)) {
        let amount = Math.abs(position.amount);
        if (position.isLong()) {
          amount *= -1;
        }

        newOrders.stop = {
          id: stopOrder.id,
          amount: amount
        };
      }
    }

    const targetOrders = orders.filter(order => order.type === ExchangeOrder.TYPE_LIMIT);
    if (targetOrders.length === 0) {
      newOrders.target = {
        amount: Math.abs(position.amount),
        price: riskRewardRatio.target
      };

      // inverse price for lose long position via sell
      if (position.side === 'long' && newOrders.target.price) {
        newOrders.target.price = newOrders.target.price * -1;
      }
    } else {
      // update order
      const targetOrder = targetOrders[0];

      // only +1% amount change is important for us
      if (OrderUtil.isPercentDifferentGreaterThen(position.amount, targetOrder.amount, 1)) {
        let amount = Math.abs(position.amount);
        if (position.isLong()) {
          amount *= -1;
        }

        newOrders.target = {
          id: targetOrder.id,
          amount: amount
        };
      }
    }

    return newOrders;
  }

  async createRiskRewardOrdersOrders(position: Position, orders: Order[], options: RiskRewardOptions): Promise<RiskRewardOrder[]> {
    const ratioOrders = await this.syncRatioRewardOrders(position, orders, options);

    const newOrders: RiskRewardOrder[] = [];
    if (ratioOrders.target) {
      if (ratioOrders.target.id) {
        newOrders.push({
          id: ratioOrders.target.id,
          price: ratioOrders.target.price,
          amount: ratioOrders.target.amount
        });
      } else {
        newOrders.push({
          price: ratioOrders.target.price || undefined,
          amount: ratioOrders.target.amount || undefined,
          type: 'target'
        });
      }
    }

    if (ratioOrders.stop) {
      if (ratioOrders.stop.id) {
        newOrders.push({
          id: ratioOrders.stop.id,
          price: ratioOrders.stop.price,
          amount: ratioOrders.stop.amount
        });
      } else {
        newOrders.push({
          price: ratioOrders.stop.price,
          amount: ratioOrders.stop.amount,
          type: 'stop'
        });
      }
    }

    return newOrders;
  }
}
