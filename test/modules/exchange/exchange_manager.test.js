const assert = require('assert');
const ExchangeManager = require('../../../src/modules/exchange/exchange_manager');
const Noop = require('../../../src/exchange/noop');
const Position = require('../../../src/dict/position');
const ExchangeOrder = require('../../../src/dict/exchange_order');

describe('#exchange manager', () => {
  it('test that exchanges are initialized', () => {
    const symbols = [
      {
        symbol: 'BTCUSD',
        periods: ['1m', '15m', '1h'],
        exchange: 'noop',
        state: 'watch'
      },
      {
        symbol: 'BTCUSD',
        periods: ['1m', '15m', '1h'],
        exchange: 'FOOBAR',
        state: 'watch'
      }
    ];

    const config = {
      noop: {
        key: 'foobar',
        secret: 'foobar'
      }
    };

    const exchangeManager = new ExchangeManager([new Noop()], {}, { symbols: symbols }, { exchanges: config });

    exchangeManager.init();

    assert.deepEqual(
      exchangeManager
        .all()
        .map(exchange => exchange.getName())
        .sort(),
      ['noop']
    );

    assert.equal(exchangeManager.get('noop').getName(), 'noop');
    assert.equal(exchangeManager.get('UNKNOWN'), undefined);
  });

  it('test positions and orders', async () => {
    const symbols = [
      {
        symbol: 'BTCUSD',
        periods: ['1m', '15m', '1h'],
        exchange: 'noop',
        state: 'watch'
      }
    ];

    const config = {
      noop: {
        key: 'foobar',
        secret: 'foobar'
      }
    };

    const exchange = new Noop();
    exchange.getPositionForSymbol = async symbol =>
      new Position(symbol, 'long', 1, undefined, undefined, 100, { stop: 0.9 });
    exchange.getPositions = async () => [new Position('BTCUSDT', 'long', 1, undefined, undefined, 100, { stop: 0.9 })];
    exchange.getOrdersForSymbol = async symbol =>
      new ExchangeOrder(
        '25035356',
        symbol,
        'open',
        undefined,
        undefined,
        undefined,
        undefined,
        'buy',
        ExchangeOrder.TYPE_LIMIT
      );

    const exchangeManager = new ExchangeManager([exchange], {}, { symbols: symbols }, { exchanges: config });

    exchangeManager.init();

    const position = await exchangeManager.getPosition('noop', 'BTCUSD');
    assert.strictEqual(position.symbol, 'BTCUSD');

    const order = await exchangeManager.getOrders('noop', 'BTCUSD');
    assert.strictEqual(order.symbol, 'BTCUSD');

    const positions = await exchangeManager.getPositions('noop', 'BTCUSD');
    assert.strictEqual(positions[0].getExchange(), 'noop');
    assert.strictEqual(positions[0].getSymbol(), 'BTCUSDT');
    assert.strictEqual(positions[0].getPosition().symbol, 'BTCUSDT');
  });
});
