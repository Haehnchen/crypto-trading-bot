import { OrderUtil } from '../../utils/order_util';
import { Order } from '../../dict/order';
import { StopLossCalculator } from '../order/stop_loss_calculator';
import { RiskRewardRatioCalculator } from '../order/risk_reward_ratio_calculator';
import { Tickers } from '../../storage/tickers';

export interface WatchdogConfig {
  name: string;
  stop?: number;
  target_percent?: number;
  stop_percent?: number;
  percent?: number;
}

export interface SymbolInstance {
  exchange: string;
  symbol: string;
  watchdogs?: WatchdogConfig[];
}

export class ExchangeOrderWatchdogListener {
  private exchangeManager: any;
  private instances: { symbols: SymbolInstance[] };
  private stopLossCalculator: StopLossCalculator;
  private riskRewardRatioCalculator: RiskRewardRatioCalculator;
  private orderExecutor: any;
  private pairStateManager: any;
  private logger: any;
  private tickers: Tickers;

  constructor(
    exchangeManager: any,
    instances: { symbols: SymbolInstance[] },
    stopLossCalculator: StopLossCalculator,
    riskRewardRatioCalculator: RiskRewardRatioCalculator,
    orderExecutor: any,
    pairStateManager: any,
    logger: any,
    tickers: Tickers
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

  onTick(): void {
    const { instances } = this;

    this.exchangeManager.all().forEach(async (exchange: any) => {
      const positions = await exchange.getPositions();

      if (positions.length === 0) {
        return;
      }

      positions.forEach(async (position: any) => {
        const pair = instances.symbols.find(
          (instance: SymbolInstance) =>
            instance.exchange === exchange.getName() && instance.symbol === position.symbol
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

        const stopLoss = pair.watchdogs.find((watchdog: WatchdogConfig) => watchdog.name === 'stoploss');
        if (stopLoss) {
          await this.stopLossWatchdog(exchange, position, stopLoss);
        }

        const riskRewardRatio = pair.watchdogs.find((watchdog: WatchdogConfig) => watchdog.name === 'risk_reward_ratio');
        if (riskRewardRatio) {
          await this.riskRewardRatioWatchdog(exchange, position, riskRewardRatio);
        }

        const stoplossWatch = pair.watchdogs.find((watchdog: WatchdogConfig) => watchdog.name === 'stoploss_watch');
        if (stoplossWatch) {
          await this.stoplossWatch(exchange, position, stoplossWatch);
        }

        const trailingStoplossWatch = pair.watchdogs.find((watchdog: WatchdogConfig) => watchdog.name === 'trailing_stop');
        if (trailingStoplossWatch) {
          await this.trailingStoplossWatch(exchange, position, trailingStoplossWatch);
        }
      });
    });
  }

  async onPositionChanged(positionStateChangeEvent: any): Promise<void> {
    if (!positionStateChangeEvent.isClosed()) {
      return;
    }

    const exchangeName = positionStateChangeEvent.getExchange();
    const symbol = positionStateChangeEvent.getSymbol();

    const pair = this.instances.symbols.find(
      (instance: SymbolInstance) => instance.exchange === exchangeName && instance.symbol === symbol
    );

    if (!pair || !pair.watchdogs) {
      return;
    }

    const found = pair.watchdogs.find((watchdog: WatchdogConfig) =>
      ['trailing_stop', 'stoploss', 'risk_reward_ratio'].includes(watchdog.name)
    );
    if (!found) {
      return;
    }

    this.logger.info(`Watchdog: position closed cleanup orders: ${JSON.stringify([exchangeName, symbol])}`);
    await this.orderExecutor.cancelAll(exchangeName, positionStateChangeEvent.getSymbol());
  }

  /**
   * @param exchange
   * @param position {Position}
   * @param stopLoss
   * @returns {Promise<void>}
   */
  async stopLossWatchdog(exchange: any, position: any, stopLoss: WatchdogConfig): Promise<void> {
    const { logger } = this;
    const { stopLossCalculator } = this;

    const orders = await exchange.getOrdersForSymbol(position.getSymbol());
    const orderChanges = OrderUtil.syncStopLossOrder(position, orders);

    orderChanges.forEach(async (orderChange: any) => {
      logger.info(
        `Stoploss update: ${JSON.stringify({
          order: orderChange,
          symbol: position.getSymbol(),
          exchange: exchange.getName()
        })}`
      );

      // update
      if (orderChange.id) {
        let amount = Math.abs(orderChange.amount);
        if (position.isLong()) {
          amount *= -1;
        }

        try {
          await exchange.updateOrder(orderChange.id, Order.createUpdateOrder(orderChange.id, undefined, amount));
        } catch (e) {
          logger.error(
            `Stoploss update error${JSON.stringify({
              error: e,
              orderChange: orderChange
            })}`
          );
        }

        return;
      }

      // create
      let price = await stopLossCalculator.calculateForOpenPosition(exchange.getName(), position, stopLoss);
      if (!price) {
        console.log('Stop loss: auto price skipping');
        return;
      }

      const calculatedPrice = exchange.calculatePrice(price, position.getSymbol());
      if (!calculatedPrice) {
        console.log('Stop loss: auto price skipping');
        return;
      }

      const order = Order.createStopLossOrder(position.getSymbol(), calculatedPrice, orderChange.amount);

      try {
        await exchange.order(order);
      } catch (e) {
        logger.error(
          `Stoploss create${JSON.stringify({
            error: e,
            order: order
          })}`
        );
      }
    });
  }

  async riskRewardRatioWatchdog(exchange: any, position: any, riskRewardRatioOptions: any): Promise<void> {
    const { logger } = this;

    const symbol = position.getSymbol();
    const orders = await exchange.getOrdersForSymbol(symbol);
    const orderChanges = await this.riskRewardRatioCalculator.createRiskRewardOrdersOrders(
      position,
      orders,
      riskRewardRatioOptions
    );

    orderChanges.forEach(async (orderChange: any) => {
      logger.info(
        `Risk Reward: needed order change detected: ${JSON.stringify({
          orderChange: orderChange,
          symbol: symbol,
          exchange: exchange.getName()
        })}`
      );

      // update
      if (orderChange.id && String(orderChange.id).length > 0) {
        logger.info(
          `Risk Reward: order update: ${JSON.stringify({
            orderChange: orderChange,
            symbol: symbol,
            exchange: exchange.getName()
          })}`
        );

        try {
          await exchange.updateOrder(
            orderChange.id,
            Order.createUpdateOrder(
              orderChange.id,
              orderChange.price || undefined,
              orderChange.amount || undefined
            )
          );
        } catch (e) {
          logger.error(
            `Risk Reward: order update error: ${JSON.stringify({
              orderChange: orderChange,
              symbol: symbol,
              exchange: exchange.getName(),
              message: e
            })}`
          );
        }

        return;
      }

      const price = exchange.calculatePrice(orderChange.price, symbol);
      if (!price) {
        logger.error(
          `Risk Reward: Invalid price: ${JSON.stringify({
            orderChange: orderChange,
            symbol: symbol,
            exchange: exchange.getName()
          })}`
        );

        return;
      }

      // we need to normalize the price here: more general solution?
      logger.info(
        `Risk Reward: order create: ${JSON.stringify({
          orderChange: orderChange,
          symbol: symbol,
          exchange: exchange.getName()
        })}`
      );

      const ourOrder =
        orderChange.type === 'stop'
          ? Order.createStopLossOrder(symbol, orderChange.price, orderChange.amount)
          : Order.createCloseLimitPostOnlyReduceOrder(symbol, orderChange.price, orderChange.amount);

      ourOrder.price = price;

      await this.orderExecutor.executeOrder(exchange.getName(), ourOrder);
    });
  }

  async stoplossWatch(exchange: any, position: any, config: WatchdogConfig): Promise<void> {
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

    let profit: number | undefined;
    const stopProfit = parseFloat(config.stop.toString());
    if (position.side === 'long') {
      if (ticker.bid < position.entry) {
        profit = (ticker.bid / position.entry - 1) * 100;
      }
    } else if (position.side === 'short') {
      if (ticker.ask > position.entry) {
        profit = (position.entry / ticker.ask - 1) * 100;
      }
    } else {
      throw new Error(`Invalid side`);
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

  async trailingStoplossWatch(exchange: any, position: any, config: WatchdogConfig): Promise<void> {
    const { logger, stopLossCalculator } = this;

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
    const orderChanges = OrderUtil.syncTrailingStopLossOrder(position, orders);
    await Promise.all(
      orderChanges.map(async (orderChange: any) => {
        if (orderChange.id) {
          // update

          let amount = Math.abs(orderChange.amount);
          if (position.isLong()) {
            amount *= -1;
          }

          return exchange.updateOrder(orderChange.id, Order.createUpdateOrder(orderChange.id, undefined, amount));
        }
        // create if target profit reached

        // calculate activation price, undefined if it is not reached yet.
        const activationPrice = await stopLossCalculator.calculateForOpenPosition(exchange.getName(), position, {
          percent: -(config.target_percent || 0)
        });

        if (!activationPrice) {
          return undefined;
        }

        const exchangeSymbol = position.symbol.substring(0, 3).toUpperCase();
        let trailingOffset = (activationPrice * parseFloat((config.stop_percent || 0).toString())) / 100;
        trailingOffset = exchange.calculatePrice(trailingOffset, exchangeSymbol);
        const order = Order.createTrailingStopLossOrder(position.symbol, trailingOffset, orderChange.amount);

        return exchange.order(order);
      })
    )
      .then((results: any) => {
        logger.info(
          `Trailing stop loss: ${JSON.stringify({
            results: results,
            exchange: exchange.getName()
          })}`
        );
      })
      .catch((e: any) => {
        logger.error(`Trailing stoploss create${JSON.stringify(e)}`);
      });
  }
}
