const ExchangeOrder = require('../../dict/exchange_order');

module.exports = class CcxtUtil {
  static createExchangeOrders(orders) {
    return orders.map(CcxtUtil.createExchangeOrder);
  }

  static createExchangeOrder(order) {
    let retry = false;

    let status;
    const orderStatus = order.status.toLowerCase();

    if (['new', 'open', 'partiallyfilled', 'pendingnew', 'doneforday', 'stopped'].includes(orderStatus)) {
      status = 'open';
    } else if (orderStatus === 'filled') {
      status = 'done';
    } else if (orderStatus === 'canceled') {
      status = 'canceled';
    } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
      status = 'rejected';
      retry = true;
    }

    const ordType = order.type.toLowerCase().replace(/[\W_]+/g, '');

    // secure the value
    let orderType;
    switch (ordType) {
      case 'limit':
        orderType = ExchangeOrder.TYPE_LIMIT;
        break;
      case 'stop':
      case 'stopmarket': // currently: binance_futures only
        orderType = ExchangeOrder.TYPE_STOP;
        break;
      case 'stoplimit':
        orderType = ExchangeOrder.TYPE_STOP_LIMIT;
        break;
      case 'market':
        orderType = ExchangeOrder.TYPE_MARKET;
        break;
      case 'trailingstop':
      case 'trailingstopmarket': // currently: binance_futures only
        orderType = ExchangeOrder.TYPE_TRAILING_STOP;
        break;
      default:
        orderType = ExchangeOrder.TYPE_UNKNOWN;
        break;
    }

    return new ExchangeOrder(
      order.id,
      order.symbol,
      status,
      order.price,
      order.amount,
      retry,
      null,
      order.side.toLowerCase() === 'sell' ? 'sell' : 'buy', // secure the value,
      orderType,
      new Date(), // no date?
      new Date(),
      JSON.parse(JSON.stringify(order))
    );
  }

  static createPositions(positions) {
    return positions.map(position => {
      let { unrealisedRoePcnt } = position;

      if (position.leverage && position.leverage > 1) {
        unrealisedRoePcnt /= position.leverage;
      }

      return new Position(
        position.symbol,
        position.currentQty < 0 ? 'short' : 'long',
        position.currentQty,
        parseFloat((unrealisedRoePcnt * 100).toFixed(2)),
        new Date(),
        position.avgEntryPrice,
        new Date(position.openingTimestamp)
      );
    });
  }
};
