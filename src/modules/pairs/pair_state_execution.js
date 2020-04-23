const moment = require('moment');
const Order = require('./../../dict/order');
const ExchangeOrder = require('./../../dict/exchange_order');

/**
 * Provide a layer to trigger order states into "buy", "sell", "close", "cancel"
 *
 * @TODO: listen for order changed to clear "managedOrders"
 *
 * @type {module.PairStateExecution}
 */
module.exports = class PairStateExecution {
  /**
   *
   * @param pairStateManager {PairStateManager}
   * @param exchangeManager
   * @param orderCalculator
   * @param orderExecutor
   * @param logger
   * @param ticker
   */
  constructor(pairStateManager, exchangeManager, orderCalculator, orderExecutor, logger, ticker) {
    this.pairStateManager = pairStateManager;
    this.exchangeManager = exchangeManager;
    this.orderCalculator = orderCalculator;
    this.orderExecutor = orderExecutor;
    this.logger = logger;
    this.ticker = ticker;
    this.lastRunAt = undefined;
  }

  async onCancelPair(pair) {
    await this.orderExecutor.cancelAll(pair.exchange, pair.symbol);
    this.pairStateManager.clear(pair.exchange, pair.symbol);
  }

  async onSellBuyPair(pair, side) {
    const position = await this.exchangeManager.getPosition(pair.exchange, pair.symbol);

    if (position && position.side === side) {
      this.pairStateManager.clear(pair.exchange, pair.symbol);
      this.logger.debug(`block ${side} order; open position:${JSON.stringify([pair.exchange, pair.symbol])}`);
      return;
    }

    const pairState = this.pairStateManager.get(pair.exchange, pair.symbol);

    /*
        let hasManagedOrder = false;
        for (let key in orders) {
            // dont self remove the managed order
            if (this.isManagedOrder(orders[key].id)) {
                hasManagedOrder = true;
                continue
            }

            await this.orderExecutor.cancelOrder(pair.exchange, orders[key].id)
        }
        */

    const exchangeOrderStored = await this.managedPairStateOrder(pairState);
    if (!exchangeOrderStored) {
      this.logger.info(
        `Pair State: Create position open order: ${JSON.stringify([pair.exchange, pair.symbol, side, pair.options])}`
      );

      const pairOptions = pair.options;
      if (position) {
        // If we have open position and we want to switch short/long, we need to add position size to order size
        pairOptions.positionAmount = position.amount;
      }

      const exchangeOrder = await this.executeOrder(pair.exchange, pair.symbol, side, pairOptions);
      if (exchangeOrder) {
        if (exchangeOrder.shouldCancelOrderProcess()) {
          // check if we need to to cancel the process
          if (exchangeOrder.status === ExchangeOrder.STATUS_REJECTED) {
            // order was canceled by exchange eg no balance or invalid amount
            this.logger.error(
              `Pair State: order rejected clearing pair state: ${JSON.stringify([
                pair.exchange,
                pair.symbol,
                exchangeOrder
              ])}`
            );
            this.pairStateManager.clear(pair.exchange, pair.symbol);
          } else {
            // just log this case
            this.logger.info(
              `Pair State: Signal canceled for invalid order: ${JSON.stringify([
                pair.exchange,
                pair.symbol,
                exchangeOrder
              ])}`
            );
            pairState.triggerRetry();
          }
        } else if (exchangeOrder.status === ExchangeOrder.STATUS_DONE) {
          // add order to know it for later usage
          this.logger.info(
            `Pair State: Order directly filled clearing state: ${JSON.stringify([
              pair.exchange,
              pair.symbol,
              exchangeOrder
            ])}`
          );
          this.pairStateManager.clear(pair.exchange, pair.symbol);
        } else {
          // add order to know it for later usage
          pairState.setExchangeOrder(exchangeOrder);
        }
      }
    }

    // found multiple order; clear this invalid state
    // we also reset our managed order here
    const newOrders = await this.exchangeManager.getOrders(pair.exchange, pair.symbol);
    if (newOrders.length > 1) {
      const state = pairState.getExchangeOrder();
      if (state) {
        newOrders
          .filter(o => state.id !== o.id && state.id != o.id)
          .forEach(async order => {
            this.logger.error(`Pair State: Clear invalid orders:${JSON.stringify([order])}`);
            try {
              await this.orderExecutor.cancelOrder(pair.exchange, order.id);
            } catch (e) {
              console.log(e);
            }
          });
      }
    }
  }

  async onClosePair(pair) {
    const position = await this.exchangeManager.getPosition(pair.exchange, pair.symbol);

    if (!position) {
      this.pairStateManager.clear(pair.exchange, pair.symbol);
      this.logger.debug(
        `Close Pair: Block selling order; no open position: ${JSON.stringify([pair.exchange, pair.symbol])}`
      );

      // clear untouched order
      const orders = await this.exchangeManager.getOrders(pair.exchange, pair.symbol);
      if (orders.length > 0) {
        this.logger.debug(`Close Pair: Found open orders clearing: ${JSON.stringify([pair.exchange, pair.symbol])}`);
        await this.orderExecutor.cancelAll(pair.exchange, pair.symbol);
      }

      return;
    }

    const pairState = this.pairStateManager.get(pair.exchange, pair.symbol);

    /*
        let orders = (await this.exchangeManager.getOrders(pair.exchange, pair.symbol));
        let hasManagedOrder = false;
        for (let key in orders) {
            // dont self remove the managed order
            if (this.isManagedOrder(orders[key].id)) {
                hasManagedOrder = true;
                continue
            }

            await this.orderExecutor.cancelOrder(pair.exchange, orders[key].id)
        }
        */

    const exchangeOrderStored = await this.managedPairStateOrder(pairState);
    if (!exchangeOrderStored) {
      this.logger.info(
        `Pair State: Create position close order: ${JSON.stringify([pair.exchange, pair.symbol, pair.position])}`
      );

      const amount = Math.abs(position.amount);

      const exchangeOrder = await this.executeCloseOrder(
        pair.exchange,
        pair.symbol,
        position.side === 'short' ? amount : amount * -1, // invert the current position
        pair.options,
        pairState
      );

      if (exchangeOrder) {
        if (exchangeOrder.shouldCancelOrderProcess()) {
          // check if we need to to cancel the process
          if (exchangeOrder.status === ExchangeOrder.STATUS_REJECTED) {
            // order was canceled by exchange eg no balance or invalid amount
            this.logger.error(
              `Pair State: order rejected clearing pair state: ${JSON.stringify([
                pair.exchange,
                pair.symbol,
                exchangeOrder
              ])}`
            );
            this.pairStateManager.clear(pair.exchange, pair.symbol);
          } else {
            // just log this case
            this.logger.error(
              `Pair State: Signal canceled for invalid order: ${JSON.stringify([
                pair.exchange,
                pair.symbol,
                exchangeOrder
              ])}`
            );
            pairState.triggerRetry();
          }
        } else if (exchangeOrder.status === ExchangeOrder.STATUS_DONE) {
          // order done
          this.logger.info(
            `Pair State: Order directly filled clearing state: ${JSON.stringify([
              pair.exchange,
              pair.symbol,
              exchangeOrder
            ])}`
          );
          this.pairStateManager.clear(pair.exchange, pair.symbol);
        } else {
          // add order to know it for later usage
          pairState.setExchangeOrder(exchangeOrder);
        }
      }
    }

    // found multiple order; clear this invalid state
    // we also reset or managed order here
    const newOrders = await this.exchangeManager.getOrders(pair.exchange, pair.symbol);
    if (newOrders.length > 1) {
      const state = pairState.getExchangeOrder();
      if (state) {
        newOrders
          .filter(o => state.id !== o.id && state.id != o.id)
          .forEach(async order => {
            this.logger.error(`Pair State: Clear invalid orders:${JSON.stringify([order])}`);
            try {
              await this.orderExecutor.cancelOrder(pair.exchange, order.id);
            } catch (e) {
              console.log(e);
            }
          });
      }
    }
  }

  async onPairStateExecutionTick() {
    // block ui running
    if (typeof this.lastRunAt !== 'undefined' && this.lastRunAt < moment().subtract(2, 'minutes')) {
      this.logger.debug('onPairStateExecutionTick blocked for running');
      console.log('onPairStateExecutionTick blocked for running');

      return;
    }

    this.lastRunAt = new Date();

    const promises = [];

    this.pairStateManager.all().forEach(pair => {
      const pairState = this.pairStateManager.get(pair.exchange, pair.symbol);
      if (pairState && pairState.getRetries() > 10) {
        this.logger.error(`Pair execution max retries reached: ${JSON.stringify([pair, pairState])}`);
        promises.push(this.onCancelPair(pair));
        return;
      }

      // cancel execution if not possible to place after some minutes
      if (pair.time < moment().subtract(60, 'minutes')) {
        this.logger.error(`Pair execution timeout cancel: ${JSON.stringify([pair, pairState])}`);
        promises.push(this.onCancelPair(pair));
        return;
      }

      switch (pair.state) {
        case 'cancel':
          promises.push(this.onCancelPair(pair));
          break;
        case 'close':
          promises.push(this.onClosePair(pair));
          break;
        case 'short':
          promises.push(this.onSellBuyPair(pair, 'short'));
          break;
        case 'long':
          promises.push(this.onSellBuyPair(pair, 'long'));
          break;
        default:
          throw `Unsupported state: ${pair.state}`;
      }
    });

    try {
      await Promise.all(promises);
    } catch (e) {
      this.logger.error(`onPairStateExecutionTick error: ${JSON.stringify(e)}`);
      console.error(e);
    }

    this.lastRunAt = undefined;
  }

  async executeOrder(exchangeName, symbol, side, options) {
    let orderSize = await this.orderCalculator.calculateOrderSize(exchangeName, symbol);
    if (!orderSize) {
      console.error(`Invalid order size: ${JSON.stringify([exchangeName, symbol, side, orderSize])}`);
      this.logger.error(`Invalid order size: ${JSON.stringify([exchangeName, symbol, side, orderSize])}`);

      return undefined;
    }

    if (options && options.positionAmount) {
      orderSize = parseFloat(orderSize) + Math.abs(options.positionAmount);
    }

    // inverse price for short
    if (side === 'short') {
      orderSize *= -1;
    }

    const myOrder =
      options && options.market === true
        ? Order.createMarketOrder(symbol, orderSize)
        : Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder(symbol, orderSize);

    return this.orderExecutor.executeOrder(exchangeName, myOrder);
  }

  async executeCloseOrder(exchangeName, symbol, orderSize, options) {
    // round to nearest exchange amount size
    const exchangeOrderSize = this.exchangeManager.get(exchangeName).calculateAmount(orderSize, symbol);
    if (!exchangeOrderSize) {
      this.logger.error(`Exchange order amount issues: ${JSON.stringify([exchangeName, symbol, orderSize])}`);
      return {};
    }

    const order =
      options && options.market === true
        ? Order.createMarketOrder(symbol, exchangeOrderSize)
        : Order.createCloseOrderWithPriceAdjustment(symbol, exchangeOrderSize);

    return this.orderExecutor.executeOrder(exchangeName, order);
  }

  async onTerminate() {
    const running = this.pairStateManager.all();

    for (const key in running) {
      const pair = running[key];

      this.logger.info(`Terminate: Force managed orders cancel: ${JSON.stringify(pair)}`);
      console.log(`Terminate: Force managed orders cancel: ${JSON.stringify(pair)}`);

      await this.onCancelPair(pair);
    }
  }

  async extractManagedPairStateOrderFromOrders(pairState) {
    const orders = await this.exchangeManager.getOrders(pairState.getExchange(), pairState.getSymbol());
    const position = await this.exchangeManager.getPosition(pairState.getExchange(), pairState.getSymbol());

    const matchingOrder = orders.filter(o => {
      if (o.getType() !== Order.TYPE_LIMIT) {
        return false;
      }

      if (o.getLongOrShortSide() === 'short' && pairState.getState() === 'short') {
        return true;
      }

      if (o.getLongOrShortSide() === 'long' && pairState.getState() === 'long') {
        return true;
      }

      if (position && pairState.getState() === 'close') {
        if (position.isShort() && o.getLongOrShortSide() === 'long') {
          return true;
        }

        if (position.isLong() && o.getLongOrShortSide() === 'short') {
          return true;
        }
      }

      return false;
    });

    if (matchingOrder.length > 0) {
      const ticker = this.ticker.get(pairState.getExchange(), pairState.getSymbol());
      if (ticker) {
        for (const order of matchingOrder) {
          const diff = Math.abs(((order.price - ticker.bid) / ticker.bid) * 100);
          if (diff <= 0.45) {
            this.logger.info(`Pair State: reuse managed order: ${JSON.stringify([diff, order])}`);
            return order;
          }
        }
      }
    }

    return undefined;
  }

  async managedPairStateOrder(pairState) {
    const exchangeOrderStored = pairState.getExchangeOrder();
    if (!exchangeOrderStored) {
      const m = await this.extractManagedPairStateOrderFromOrders(pairState);
      if (m) {
        pairState.setExchangeOrder(m);
        return m;
      }

      return undefined;
    }

    const currentOrder = await this.exchangeManager.findOrderById(pairState.getExchange(), exchangeOrderStored.id);
    if (currentOrder) {
      return currentOrder;
    }

    const m = await this.extractManagedPairStateOrderFromOrders(pairState);
    if (m) {
      pairState.setExchangeOrder(m);
      return m;
    }

    this.logger.info(
      `Pair State: Clearing unknown stored exchangeOrder: ${JSON.stringify([
        exchangeOrderStored.id,
        exchangeOrderStored
      ])}`
    );

    pairState.setExchangeOrder(null);

    return undefined;
  }
};
