const moment = require('moment');

module.exports = {
  findPositionEntryFromTrades: (trades, balance, side) => {
    if (trades.length === 0) {
      return undefined;
    }

    if (!['short', 'long'].includes(side)) {
      throw Error(`Invalid entry side: ${side}`);
    }

    const result = {
      size: 0,
      costs: 0
    };

    const sideBlocker = side === 'short' ? 'sell' : 'buy';
    for (const trade of trades) {
      // stop if last trade is a sell
      if (trade.side !== sideBlocker) {
        // stop if order is really old
        if (trade.time < new Date(moment().subtract(2, 'days'))) {
          break;
        }

        continue;
      }

      // stop if price out of range window
      const number = result.size + parseFloat(trade.size);
      if (number > balance * 1.15) {
        break;
      }

      // stop on old fills
      if (result.time) {
        const secDiff = Math.abs(new Date(trade.time).getTime() - new Date(result.time).getTime());

        // out of 7 day range
        if (secDiff > 60 * 60 * 24 * 7 * 1000) {
          break;
        }
      }

      result.size += parseFloat(trade.size);
      const costs = parseFloat(trade.size) * parseFloat(trade.price) + parseFloat(trade.fee || 0);

      result.costs += costs;

      // first trade wins for open
      if (trade.time && !result.time) {
        result.time = trade.time;
      }
    }

    result.average_price = result.costs / result.size;

    if (result.size === 0 || result.costs === 0) {
      return undefined;
    }

    return result;
  }
};
