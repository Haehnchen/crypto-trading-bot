const orderUtil = require('../../utils/order_util');
const Order = require('../../dict/order');

module.exports = class ExchangeOrderWatchdogListener {
  constructor(
    exchangeManager,
    instances,
    stopLossCalculator,
    riskRewardRatioCalculator,
    orderExecutor,
    pairStateManager,
    logger,
    tickers
  ) {
    this.exchangeManager = exchangeManager;
    this.instances = instances;
    this.stopLossCalculator = stopLossCalculator;
    this.riskRewardRatioCalculator = riskRewardRatioCalculator;
    this.orderExecutor = orderExecutor;
    this.pairStateManager = pairStateManager;
    this.logger = logger;
    this.tickers = tickers;
  }

  onTick() {
    const { instances } = this;

    this.exchangeManager.all().forEach(async exchange => {
      const positions = await exchange.getPositions();

      if (positions.length === 0) {
        return;
      }

      positions.forEach(async position => {
        const pair = instances.symbols.find(
          instance => instance.exchange === exchange.getName() && instance.symbol === position.symbol
        );

        if (!pair || !pair.watchdogs) {
          return;
        }

        if (!this.pairStateManager.isNeutral(exchange.getName(), position.symbol)) {
          this.logger.debug(
            `Watchdog: block for action in place: ${JSON.stringify({
              exchange: exchange.getName(),
              symbol: position.symbol
            })}`
          );

          return;
        }

        const stopLoss = pair.watchdogs.find(watchdog => watchdog.name === 'stoploss');
        if (stopLoss) {
          await this.stopLossWatchdog(exchange, position, stopLoss);
        }

        const riskRewardRatio = pair.watchdogs.find(watchdog => watchdog.name === 'risk_reward_ratio');
        if (riskRewardRatio) {
          await this.riskRewardRatioWatchdog(exchange, position, riskRewardRatio);
        }

        const stoplossWatch = pair.watchdogs.find(watchdog => watchdog.name === 'stoploss_watch');
        if (stoplossWatch) {
          await this.stoplossWatch(exchange, position, stoplossWatch);
        }

        const trailingStoplossWatch = pair.watchdogs.find(watchdog => watchdog.name === 'trailing_stop');
        if (trailingStoplossWatch) {
          await this.trailingStoplossWatch(exchange, position, trailingStoplossWatch);
        }
      });
    });
  }

  async onPositionChanged(positionStateChangeEvent) {
    if (!positionStateChangeEvent.isClosed()) {
      return;
    }

    const exchangeName = positionStateChangeEvent.getExchange();
    const symbol = positionStateChangeEvent.getSymbol();

    const pair = this.instances.symbols.find(
      instance => instance.exchange === exchangeName && instance.symbol === symbol
    );

    if (!pair || !pair.watchdogs) {
      return;
    }

    const found = pair.watchdogs.find(watchdog =>
      ['trailing_stop', 'stoploss', 'risk_reward_ratio'].includes(watchdog.name)
    );
    if (!found) {
      return;
    }

    this.logger.info(`Watchdog: position closed cleanup orders: ${JSON.stringify([exchangeName, symbol])}`);
    await this.orderExecutor.cancelAll(exchangeName, positionStateChangeEvent.getSymbol());
  }

  async stopLossWatchdog(exchange, position, stopLoss) {
    const { logger } = this;
    const { stopLossCalculator } = this;

    const orders = await exchange.getOrdersForSymbol(position.symbol);
    const orderChanges = orderUtil.syncStopLossOrder(position, orders);

    orderChanges.forEach(async orderChange => {
      logger.info(
        `Stoploss update: ${JSON.stringify({
          order: orderChange,
          symbol: position.symbol,
          exchange: exchange.getName()
        })}`
      );

      // update
      if (orderChange.id) {
        try {
          await exchange.updateOrder(orderChange.id, {
            amount: orderChange.amount
          });
        } catch (e) {
          const msg = `Stoploss update error${JSON.stringify({
            error: e,
            orderChange: orderChange
          })}`;

          logger.error(msg);
          console.error(msg);
        }

        return;
      }

      // create
      let price = await stopLossCalculator.calculateForOpenPosition(exchange.getName(), position, stopLoss);
      if (!price) {
        console.log('Stop loss: auto price skipping');
        return;
      }

      price = exchange.calculatePrice(price, position.symbol);
      if (!price) {
        console.log('Stop loss: auto price skipping');
        return;
      }

      const order = Order.createStopLossOrder(position.symbol, price, orderChange.amount);

      try {
        await exchange.order(order);
      } catch (e) {
        const msg = `Stoploss create${JSON.stringify({
          error: e,
          order: order
        })}`;

        logger.error(msg);
        console.error(msg);
      }
    });
  }

  async riskRewardRatioWatchdog(exchange, position, riskRewardRatioOptions) {
    const { logger } = this;

    const orders = await exchange.getOrdersForSymbol(position.symbol);
    const orderChanges = await this.riskRewardRatioCalculator.createRiskRewardOrdersOrders(
      position,
      orders,
      riskRewardRatioOptions
    );

    orderChanges.forEach(async order => {
      logger.info(
        `Risk Reward: order change: ${JSON.stringify({
          order: order,
          symbol: position.symbol,
          exchange: exchange.getName()
        })}`
      );

      // update
      if (order.id && order.id.length > 0) {
        logger.info(
          `Risk Reward: order update: ${JSON.stringify({
            order: order,
            symbol: position.symbol,
            exchange: exchange.getName()
          })}`
        );

        try {
          await exchange.updateOrder(order.id, { amount: order.amount });
        } catch (e) {
          logger.error(
            `Risk Reward: order update error: ${JSON.stringify({
              order: order,
              symbol: position.symbol,
              exchange: exchange.getName(),
              message: e
            })}`
          );
        }

        return;
      }

      const price = exchange.calculatePrice(order.price, order.symbol);
      if (!price) {
        logger.error(
          `Risk Reward: Invalid price: ${JSON.stringify({
            order: order,
            symbol: position.symbol,
            exchange: exchange.getName()
          })}`
        );

        return;
      }

      // we need to normalize the price here: more general solution?
      order.price = price;

      logger.info(
        `Risk Reward: order create: ${JSON.stringify({
          order: order,
          symbol: position.symbol,
          exchange: exchange.getName()
        })}`
      );

      await this.orderExecutor.executeOrder(exchange.getName(), order);
    });
  }

  async stoplossWatch(exchange, position, config) {
    if (!config.stop || config.stop < 0.1 || config.stop > 50) {
      this.logger.error('Stoploss Watcher: invalid stop configuration need "0.1" - "50"');
      return;
    }

    if (typeof position.entry === 'undefined') {
      this.logger.error(`Stoploss Watcher: no entry for position: ${JSON.stringify(position)}`);
      return;
    }

    const ticker = this.tickers.get(exchange.getName(), position.symbol);
    if (!ticker) {
      this.logger.error(`Stoploss Watcher: no ticker found ${JSON.stringify([exchange.getName(), position.symbol])}`);
      return;
    }

    let profit;
    const stopProfit = parseFloat(config.stop);
    if (position.side === 'long') {
      if (ticker.bid < position.entry) {
        profit = (ticker.bid / position.entry - 1) * 100;
      }
    } else if (position.side === 'short') {
      if (ticker.ask > position.entry) {
        profit = (position.entry / ticker.ask - 1) * 100;
      }
    } else {
      throw 'Invalid side';
    }

    if (typeof profit === 'undefined' || profit > 0) {
      return;
    }

    // TODO: provide cancel if price recovered !?

    const maxLoss = Math.abs(stopProfit) * -1;
    if (profit < maxLoss) {
      this.logger.info(
        `Stoploss Watcher: stop triggered: ${JSON.stringify([
          exchange.getName(),
          position.symbol,
          maxLoss.toFixed(2),
          profit.toFixed(2)
        ])}`
      );
      this.pairStateManager.update(exchange.getName(), position.symbol, 'close');
    }
  }

  async trailingStoplossWatch(exchange, position, config) {
    const { logger } = this;

    if (
      !config.target_percent ||
      config.target_percent < 0.1 ||
      config.target_percent > 50 ||
      !config.stop_percent ||
      config.stop_percent < 0.1 ||
      config.stop_percent > 50
    ) {
      this.logger.error('Stoploss Watcher: invalid stop configuration need "0.1" - "50"');
      return;
    }

    if (typeof position.entry === 'undefined') {
      this.logger.error(`Stoploss Watcher: no entry for position: ${JSON.stringify(position)}`);
      return;
    }

    const orders = await exchange.getOrdersForSymbol(position.symbol);
    const orderChanges = orderUtil.syncTrailingStopLossOrder(position, orders);

    orderChanges.forEach(async orderChange => {
      if (orderChange.id) {
        // update

        logger.info(
          `Stoploss update: ${JSON.stringify({
            order: orderChange,
            symbol: position.symbol,
            exchange: exchange.getName()
          })}`
        );
        exchange.updateOrder(orderChange.id, {
          amount: orderChange.amount
        });
      } else {
        // create if target profit reached

        // calculate activation price, undefined if it is not reached yet.
        const activationPrice = await this.stopLossCalculator.calculateForOpenPosition(exchange.getName(), position, {
          percent: -config.target_percent
        });

        if (!activationPrice) {
          return;
        }

        const exchangeSymbol = position.symbol.substring(0, 3).toUpperCase();
        let trailingOffset = (activationPrice * parseFloat(config.stop_percent)) / 100;
        trailingOffset = exchange.calculatePrice(trailingOffset, exchangeSymbol);
        const order = Order.createTrailingStopLossOrder(position.symbol, trailingOffset, orderChange.amount);

        try {
          await exchange.order(order);

          logger.info(
            `Trailing stop loss activated: ${JSON.stringify({
              position: position,
              exchange: exchange.getName()
            })}`
          );
        } catch (e) {
          const msg = `Trailing stoploss create${JSON.stringify({
            error: e,
            order: order
          })}`;

          logger.error(msg);
          console.error(msg);
        }
      }
    });
  }
};
