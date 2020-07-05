const moment = require('moment');
const Order = require('../../dict/order');
const ExchangeOrder = require('../../dict/exchange_order');

/**
 * Provide a layer to trigger order states into "buy", "sell", "close", "cancel"
 *
 * @TODO: listen for order changed to clear "managedOrders"
 *
 * @type {module.PairStateExecution}
 */
module.exports = class PairStateExecution {
  /**
   * @param exchangeManager
   * @param orderCalculator
   * @param orderExecutor
   * @param logger
   * @param ticker
   */
  constructor(exchangeManager, orderCalculator, orderExecutor, logger, ticker) {
    this.exchangeManager = exchangeManager;
    this.orderCalculator = orderCalculator;
    this.orderExecutor = orderExecutor;
    this.logger = logger;
    this.ticker = ticker;
  }

  /**
   * @param pairState {PairState}
   * @returns {Promise<void>}
   */
  async onCancelPair(pairState) {
    await this.orderExecutor.cancelAll(pairState.getExchange(), pairState.getSymbol());
    pairState.clear();
  }

  /**
   * @param pairState {PairState}
   * @returns {Promise<void>}
   */
  async onSellBuyPair(pairState) {
    const position = await this.exchangeManager.getPosition(pairState.exchange, pairState.symbol);

    if (position) {
      pairState.clear();
      this.logger.debug(
        `block ${pairState.getState()} order; open position:${JSON.stringify([pairState.exchange, pairState.symbol])}`
      );
      return;
    }

    const exchangeOrderStored = await this.managedPairStateOrder(pairState);
    if (!exchangeOrderStored) {
      this.logger.info(
        `Pair State: Create position open order: ${JSON.stringify([
          pairState.exchange,
          pairState.symbol,
          pairState.getState(),
          pairState.options
        ])}`
      );

      const exchangeOrder = await this.pairStateExecuteOrder(pairState);

      if (exchangeOrder) {
        if (exchangeOrder.shouldCancelOrderProcess()) {
          // check if we need to to cancel the process
          if (exchangeOrder.status === ExchangeOrder.STATUS_REJECTED) {
            // order was canceled by exchange eg no balance or invalid amount
            this.logger.error(
              `Pair State: order rejected clearing pair state: ${JSON.stringify([
                pairState.exchange,
                pairState.symbol,
                exchangeOrder
              ])}`
            );
            pairState.clear(pairState.exchange, pairState.symbol);
          } else {
            // just log this case
            this.logger.info(
              `Pair State: Signal canceled for invalid order: ${JSON.stringify([
                pairState.exchange,
                pairState.symbol,
                exchangeOrder
              ])}`
            );
            pairState.triggerRetry();
          }
        } else if (exchangeOrder.status === ExchangeOrder.STATUS_DONE) {
          // add order to know it for later usage
          this.logger.info(
            `Pair State: Order directly filled clearing state: ${JSON.stringify([
              pairState.exchange,
              pairState.symbol,
              exchangeOrder
            ])}`
          );
          pairState.clear(pairState.exchange, pairState.symbol);
        } else {
          // add order to know it for later usage
          pairState.setExchangeOrder(exchangeOrder);
        }
      }
    }

    // found multiple order; clear this invalid state
    // we also reset our managed order here
    const newOrders = await this.exchangeManager.getOrders(pairState.exchange, pairState.symbol);
    if (newOrders.length > 1) {
      const state = pairState.getExchangeOrder();
      if (state) {
        newOrders
          .filter(o => state.id !== o.id && state.id != o.id)
          .forEach(async order => {
            this.logger.error(`Pair State: Clear invalid orders:${JSON.stringify([order])}`);
            try {
              await this.orderExecutor.cancelOrder(pairState.exchange, order.id);
            } catch (e) {
              console.log(e);
            }
          });
      }
    }
  }

  async onClosePair(pairState) {
    const position = await this.exchangeManager.getPosition(pairState.exchange, pairState.symbol);

    if (!position) {
      pairState.clear(pairState.exchange, pairState.symbol);
      this.logger.debug(
        `Close Pair: Block selling order; no open position: ${JSON.stringify([pairState.exchange, pairState.symbol])}`
      );

      // clear untouched order
      const orders = await this.exchangeManager.getOrders(pairState.exchange, pairState.symbol);
      if (orders.length > 0) {
        this.logger.debug(
          `Close Pair: Found open orders clearing: ${JSON.stringify([pairState.exchange, pairState.symbol])}`
        );
        await this.orderExecutor.cancelAll(pairState.exchange, pairState.symbol);
      }

      return;
    }

    const exchangeOrderStored = await this.managedPairStateOrder(pairState);
    if (!exchangeOrderStored) {
      this.logger.info(
        `Pair State: Create position close order: ${JSON.stringify([
          pairState.exchange,
          pairState.symbol,
          pairState.position
        ])}`
      );

      const amount = Math.abs(position.amount);

      const exchangeOrder = await this.executeCloseOrder(
        pairState.exchange,
        pairState.symbol,
        position.side === 'short' ? amount : amount * -1, // invert the current position
        pairState.options,
        pairState
      );

      if (exchangeOrder) {
        if (exchangeOrder.shouldCancelOrderProcess()) {
          // check if we need to to cancel the process
          if (exchangeOrder.status === ExchangeOrder.STATUS_REJECTED) {
            // order was canceled by exchange eg no balance or invalid amount
            this.logger.error(
              `Pair State: order rejected clearing pair state: ${JSON.stringify([
                pairState.exchange,
                pairState.symbol,
                exchangeOrder
              ])}`
            );
            pairState.clear(pairState.exchange, pairState.symbol);
          } else {
            // just log this case
            this.logger.error(
              `Pair State: Signal canceled for invalid order: ${JSON.stringify([
                pairState.exchange,
                pairState.symbol,
                exchangeOrder
              ])}`
            );
            pairState.triggerRetry();
          }
        } else if (exchangeOrder.status === ExchangeOrder.STATUS_DONE) {
          // order done
          this.logger.info(
            `Pair State: Order directly filled clearing state: ${JSON.stringify([
              pairState.exchange,
              pairState.symbol,
              exchangeOrder
            ])}`
          );
          pairState.clear(pairState.exchange, pairState.symbol);
        } else {
          // add order to know it for later usage
          pairState.setExchangeOrder(exchangeOrder);
        }
      }
    }

    // found multiple order; clear this invalid state
    // we also reset or managed order here
    const newOrders = await this.exchangeManager.getOrders(pairState.exchange, pairState.symbol);
    if (newOrders.length > 1) {
      const state = pairState.getExchangeOrder();
      if (state) {
        newOrders
          .filter(o => state.id !== o.id && state.id != o.id)
          .forEach(async order => {
            this.logger.error(`Pair State: Clear invalid orders:${JSON.stringify([order])}`);
            try {
              await this.orderExecutor.cancelOrder(pairState.exchange, order.id);
            } catch (e) {
              console.log(e);
            }
          });
      }
    }
  }

  async onPairStateExecutionTick(pairState) {
    if (pairState.getRetries() > 10) {
      this.logger.error(`Pair execution max retries reached: ${JSON.stringify([pairState])}`);
      await this.onCancelPair(pairState);
      return;
    }

    // cancel execution if not possible to place after some minutes
    if (pairState.getTime() < moment().subtract(25, 'minutes')) {
      this.logger.error(`Pair execution timeout cancel: ${JSON.stringify([pairState])}`);
      await this.onCancelPair(pairState);
      return;
    }

    switch (pairState.getState()) {
      case 'cancel':
        await this.onCancelPair(pairState);
        break;
      case 'close':
        await this.onClosePair(pairState);
        break;
      case 'long':
      case 'short':
        await this.onSellBuyPair(pairState);
        break;
      default:
        throw new Error(`Unsupported state: ${pairState.getState()}`);
    }
  }

  /**
   * @param pair {PairState}
   */
  async pairStateExecuteOrder(pair) {
    const exchangeName = pair.getExchange();
    const symbol = pair.getSymbol();
    const side = pair.getState();
    const options = pair.getOptions();

    let orderSize = await this.orderCalculator.calculateOrderSizeCapital(exchangeName, symbol, pair.getCapital());
    if (!orderSize) {
      console.error(`Invalid order size: ${JSON.stringify([exchangeName, symbol, side, orderSize])}`);
      this.logger.error(`Invalid order size: ${JSON.stringify([exchangeName, symbol, side, orderSize])}`);

      return;
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
