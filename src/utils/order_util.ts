import { ExchangeOrder, ExchangeOrderType } from '../dict/exchange_order';
import { Position } from '../dict/position';

export interface OrderSync {
  id?: string | number;
  amount: number;
}

export function calculateOrderAmount(price: number, capital: number): number {
  return capital / price;
}

export function syncOrderByType(position: Position, orders: ExchangeOrder[], type: ExchangeOrderType): OrderSync[] {
  const stopOrders = orders.filter(order => order.type === type);
  if (stopOrders.length === 0) {
    return [
      {
        amount: Math.abs(position.amount)
      }
    ];
  }

  const stopOrder = stopOrders[0];

  // only update if we 1 % out of range; to get not unit amount lot size issues
  if (isPercentDifferentGreaterThen(position.amount, stopOrder.amount, 1)) {
    return [
      {
        id: stopOrder.id,
        amount: position.amount
      }
    ];
  }

  return [];
}

export function syncStopLossOrder(position: Position, orders: ExchangeOrder[]): OrderSync[] {
  return syncOrderByType(position, orders, ExchangeOrder.TYPE_STOP);
}

export function syncTrailingStopLossOrder(position: Position, orders: ExchangeOrder[]): OrderSync[] {
  return syncOrderByType(position, orders, ExchangeOrder.TYPE_TRAILING_STOP);
}

/**
 * LTC: "0.008195" => "0.00820"
 */
export function calculateNearestSize(num: number, tickSize: number): number | string {
  const number = Math.trunc(num / tickSize) * tickSize;

  // fix float issues:
  // 0.0085696 => 0.00001 = 0.00857000...001
  const points = tickSize.toString().split('.');
  if (points.length < 2) {
    return number;
  }

  return number.toFixed(points[1].length);
}

export function isPercentDifferentGreaterThen(value1: number, value2: number, percentDiff: number): boolean {
  // we dont care about negative values
  const value1Abs = Math.abs(value1);
  const value2Abs = Math.abs(value2);

  return Math.abs((value1Abs - value2Abs) / ((value1Abs + value2Abs) / 2)) * 100 > percentDiff;
}

/**
 * Percent different between to values, independent of smaller or bigger
 */
export function getPercentDifferent(orderPrice: number, currentPrice: number): number {
  return orderPrice > currentPrice
    ? 100 - (currentPrice / orderPrice) * 100
    : 100 - (orderPrice / currentPrice) * 100;
}
