module.exports = {
  /**
   *
   * @param {string} side
   * @param {number} currentPrice
   * @param {number} entryPrice
   * @returns {number}
   */
  getProfitAsPercent: (side, currentPrice, entryPrice) => {
    switch (side) {
      case 'long':
        return parseFloat(((currentPrice / entryPrice - 1) * 100).toFixed(2));
      case 'short':
        return parseFloat(((entryPrice / currentPrice - 1) * 100).toFixed(2));
      default:
        throw new Error(`Invalid direction given for profit ${side}`);
    }
  },

  camelToSnakeCase: (text) => {
    return text.replace(/(.)([A-Z][a-z]+)/, '$1_$2')
      .replace(/([a-z0-9])([A-Z])/, '$1_$2')
      .toLowerCase();
  }
};
