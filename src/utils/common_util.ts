export type PositionSide = 'long' | 'short';

export function getProfitAsPercent(side: PositionSide, currentPrice: number, entryPrice: number): number {
  switch (side) {
    case 'long':
      return parseFloat(((currentPrice / entryPrice - 1) * 100).toFixed(2));
    case 'short':
      return parseFloat(((entryPrice / currentPrice - 1) * 100).toFixed(2));
    default:
      throw new Error(`Invalid direction given for profit ${side}`);
  }
}
