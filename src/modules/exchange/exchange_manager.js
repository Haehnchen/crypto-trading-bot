const _ = require('lodash');
const ExchangePosition = require('../../dict/exchange_position');

module.exports = class ExchangeManager {
  constructor(exchangesIterator, logger, instances, config) {
    this.logger = logger;
    this.instances = instances;
    this.config = config;
    this.exchangesIterator = exchangesIterator;

    this.exchanges = [];
  }

  init() {
    const exchanges = this.exchangesIterator;

    const symbols = {};

    exchanges
      .map(exchange => exchange.getName())
      .forEach(exchangeName => {
        const pairs = this.instances.symbols.filter(symbol => {
          return symbol.exchange === exchangeName;
        });

        if (pairs.length === 0) {
          return;
        }

        symbols[exchangeName] = pairs;
      });

    const activeExchanges = exchanges.filter(exchange => exchange.getName() in symbols);

    activeExchanges.forEach(activeExchange =>
      activeExchange.start(
        _.get(this.config, `exchanges.${activeExchange.getName()}`, {}),
        symbols[activeExchange.getName()]
      )
    );

    this.exchanges = activeExchanges;
  }

  all() {
    return this.exchanges;
  }

  get(name) {
    return this.exchanges.find(exchange => exchange.getName() === name);
  }

  async getPosition(exchangeName, symbol) {
    return this.get(exchangeName).getPositionForSymbol(symbol);
  }

  async getPositions() {
    const positions = [];

    for (const exchange of this.all()) {
      const exchangeName = exchange.getName();

      const exchangePositions = (await exchange.getPositions()).map(pos => new ExchangePosition(exchangeName, pos));

      positions.push(...exchangePositions);
    }

    return positions;
  }

  async getOrders(exchangeName, symbol) {
    return this.get(exchangeName).getOrdersForSymbol(symbol);
  }

  async findOrderById(exchangeName, id) {
    return this.get(exchangeName).findOrderById(id);
  }
};
