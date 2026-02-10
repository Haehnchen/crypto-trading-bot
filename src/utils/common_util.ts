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

export function camelToSnakeCase(text: string): string {
  return text.replace(/(.)([A-Z][a-z]+)/, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/, '$1_$2')
    .toLowerCase();
}

/**
 * Export an object with all functions for backwards compatibility with JS imports
 */
export const CommonUtil = {
  getProfitAsPercent,
  camelToSnakeCase
};
