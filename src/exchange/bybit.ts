import WebSocket from 'ws';
import querystring from 'querystring';
import moment from 'moment';
import request from 'request';
import crypto from 'crypto';
import _ from 'lodash';
import { Ticker } from '../dict/ticker';
import { TickerEvent } from '../event/ticker_event';
import { Order } from '../dict/order';
import { ExchangeCandlestick } from '../dict/exchange_candlestick';
import { Resample } from '../utils/resample';
import { Position } from '../dict/position';
import { ExchangeOrder, ExchangeOrderStatus, ExchangeOrderSide, ExchangeOrderType } from '../dict/exchange_order';
import { orderUtil } from '../utils/order_util';
import { EventEmitter } from 'events';
import type { Logger } from '../modules/services';
import type { QueueManager } from '../utils/queue';
import type { CandleImporter } from '../modules/system/candle_importer';
import type { Throttler } from '../utils/throttler';
import type { RequestClient } from '../utils/request_client';
import type { CandlestickResample } from '../modules/system/candlestick_resample';

export class Bybit {
  private eventEmitter: EventEmitter;
  private logger: Logger;
  private queue: QueueManager;
  private candleImporter: CandleImporter;
  private requestClient: RequestClient;
  private throttler: Throttler;

  private apiKey: string | undefined;
  private apiSecret: string | undefined;
  private tickSizes: Record<string, number>;
  private lotSizes: Record<string, number>;
  private positions: Record<string, Position>;
  private orders: Record<string, ExchangeOrder>;
  private tickers: Record<string, Ticker>;
  private symbols: any[];
  private intervals: NodeJS.Timeout[];
  private leverageUpdated: Record<string, Date>;

  constructor(
    eventEmitter: EventEmitter,
    requestClient: RequestClient,
    candlestickResample: CandlestickResample,
    logger: Logger,
    queue: QueueManager,
    candleImporter: CandleImporter,
    throttler: Throttler
  ) {
    this.eventEmitter = eventEmitter;
    this.logger = logger;
    this.queue = queue;
    this.candleImporter = candleImporter;
    this.requestClient = requestClient;
    this.throttler = throttler;

    this.apiKey = undefined;
    this.apiSecret = undefined;
    this.tickSizes = {};
    this.lotSizes = {};

    this.positions = {};
    this.orders = {};
    this.tickers = {};
    this.symbols = [];
    this.intervals = [];
    this.leverageUpdated = {};
  }

  start(config: any, symbols: any[]): void {
    const { eventEmitter } = this;
    const { logger } = this;
    const { tickSizes } = this;
    const { lotSizes } = this;
    this.intervals = [];

    this.symbols = symbols;
    this.positions = {};
    this.orders = {};

    this.requestClient
      .executeRequestRetry(
        {
          url: `${this.getBaseUrl()}/v2/public/symbols`
        },
        (result: any) => {
          return result && result.response && result.response.statusCode >= 500;
        }
      )
      .then((response: any) => {
        const body = JSON.parse(response.body);
        if (!body.result) {
          this.logger.error(`Bybit: invalid instruments request: ${response.body}`);
          return;
        }

        body.result.forEach((instrument: any) => {
          tickSizes[instrument.name] = parseFloat(instrument.price_filter.tick_size);
          lotSizes[instrument.name] = parseFloat(instrument.lot_size_filter.qty_step);
        });
      });

    const ws = new WebSocket('wss://stream.bybit.com/realtime');

    const me = this;
    ws.onopen = function () {
      me.logger.info('Bybit: Connection opened.');

      symbols.forEach((symbol: any) => {
        symbol.periods.forEach((p: string) => {
          const periodMinute = Resample.convertPeriodToMinute(p);

          ws.send(JSON.stringify({ op: 'subscribe', args: [`klineV2.${periodMinute}.${symbol.symbol}`] }));
        });

        ws.send(JSON.stringify({ op: 'subscribe', args: [`instrument_info.100ms.${symbol.symbol}`] }));
      });

      if (config.key && config.secret && config.key.length > 0 && config.secret.length > 0) {
        me.logger.info('Bybit: sending auth request');
        me.apiKey = config.key;
        me.apiSecret = config.secret;

        const expires = new Date().getTime() + 10000;
        const signature = crypto.createHmac('sha256', config.secret).update(`GET/realtime${expires}`).digest('hex');

        ws.send(JSON.stringify({ op: 'auth', args: [config.key, expires, signature] }));

        // load full order and positions in intervals; in case websocket is out opf sync
        setTimeout(() => {
          me.intervals.push(
            setInterval(
              (function f() {
                me.throttler.addTask(
                  `bybit_sync_all_orders`,
                  async () => {
                    await me.syncOrdersViaRestApi(symbols.map((symbol: any) => symbol.symbol));
                  },
                  1245
                );

                me.throttler.addTask(`bybit_sync_positions`, me.syncPositionViaRestApi.bind(me), 1245);
                return f;
              })(),
              60000
            )
          );
        }, 5000);
      } else {
        me.logger.info('Bybit: Starting as anonymous; no trading possible');
      }
    };

    ws.onmessage = async function (event: any) {
      if (event.type === 'message') {
        const data = JSON.parse(event.data);

        if ('success' in data && data.success === false) {
          me.logger.error(`Bybit: error ${event.data}`);
          console.log(`Bybit: error ${event.data}`);
        } else if ('success' in data && data.success === true) {
          if (data.request && data.request.op === 'auth') {
            me.logger.info('Bybit: Auth successful');

            ws.send(JSON.stringify({ op: 'subscribe', args: ['order'] }));
            ws.send(JSON.stringify({ op: 'subscribe', args: ['stop_order'] }));
            ws.send(JSON.stringify({ op: 'subscribe', args: ['position'] }));
            ws.send(JSON.stringify({ op: 'subscribe', args: ['execution'] }));
          }
        } else if (data.topic && data.topic.startsWith('kline.')) {
          const candle = data.data;

          const candleStick = new ExchangeCandlestick(
            me.getName(),
            candle.symbol,
            candle.interval,
            candle.open_time,
            candle.open,
            candle.high,
            candle.low,
            candle.close,
            candle.volume
          );

          await me.candleImporter.insertThrottledCandles([candleStick]);
        } else if (data.data && data.topic && data.topic.startsWith('instrument_info.')) {
          let instruments: any[] = [];
          if (data.data.update) {
            instruments = data.data.update;
          } else if (data.data.last_price_e4) {
            instruments = [data.data];
          }

          instruments.forEach((instrument: any) => {
            // update and init
            if (!instrument.last_price_e4) {
              return;
            }

            const price = instrument.last_price_e4 / 10000;

            let bid = price;
            let ask = price;

            const { symbol } = instrument;

            // add price spread around the last price; as we not getting the bid and ask of the orderbook directly
            // prevent also floating issues
            if (symbol in me.tickSizes) {
              bid = parseFloat(String(orderUtil.calculateNearestSize(bid - me.tickSizes[symbol], me.tickSizes[symbol])));
              ask = parseFloat(String(orderUtil.calculateNearestSize(ask + me.tickSizes[symbol], me.tickSizes[symbol])));
            }

            eventEmitter.emit(
              'ticker',
              new TickerEvent(me.getName(), symbol, (me.tickers[symbol] = new Ticker(me.getName(), symbol, parseInt(moment().format('X'), 10), bid, ask)))
            );
          });
        } else if (data.data && data.topic && ['order', 'stop_order'].includes(data.topic.toLowerCase())) {
          const orders = data.data;

          Bybit.createOrders(orders).forEach((order: ExchangeOrder) => {
            me.triggerOrder(order);
          });

          me.throttler.addTask(
            `bybit_sync_all_orders`,
            async () => {
              await me.syncOrdersViaRestApi(symbols.map((symbol: any) => symbol.symbol));
            },
            1245
          );
        } else if (data.data && data.topic && data.topic.toLowerCase() === 'position') {
          const positionsRaw = data.data;
          const positions: any[] = [];

          positionsRaw.forEach((positionRaw: any) => {
            if (!['buy', 'sell'].includes(positionRaw.side.toLowerCase())) {
              delete me.positions[positionRaw.symbol];
            } else {
              positions.push(positionRaw);
            }
          });

          Bybit.createPositionsWithOpenStateOnly(positions).forEach((position: Position) => {
            me.positions[position.symbol] = position;
          });

          me.throttler.addTask(`bybit_sync_positions`, me.syncPositionViaRestApi.bind(me), 1545);
        }
      }
    };

    ws.onclose = function () {
      logger.info('Bybit: Connection closed.');

      for (const interval of me.intervals) {
        clearInterval(interval);
      }

      me.intervals = [];

      // retry connecting after some second to not bothering on high load
      setTimeout(() => {
        me.start(config, symbols);
      }, 10000);
    };

    symbols.forEach((symbol: any) => {
      symbol.periods.forEach((period: string) => {
        // for bot init prefill data: load latest candles from api
        this.queue.add(async () => {
          const minutes = Resample.convertPeriodToMinute(period);

          // from is required calculate to be inside window
          const from = Math.floor(new Date().getTime() / 1000) - minutes * 195 * 60;

          const s = `${me.getBaseUrl()}/v2/public/kline/list?symbol=${symbol.symbol}&from=${from}&interval=${minutes}`;
          await new Promise<void>((resolve, reject) => {
            request(s, { json: true }, async (err, res, body) => {
              if (err) {
                console.log(`Bybit: Candle backfill error: ${String(err)}`);
                logger.error(`Bybit: Candle backfill error: ${String(err)}`);
                resolve();
                return;
              }

              if (!body || !body.result || !Array.isArray(body.result)) {
                console.log(`Bybit: Candle backfill error: ${JSON.stringify(body)}`);
                logger.error(`Bybit Candle backfill error: ${JSON.stringify(body)}`);
                resolve();
                return;
              }

              const candleSticks = body.result.map((candle: any) => {
                return new ExchangeCandlestick(
                  me.getName(),
                  candle.symbol,
                  period,
                  candle.open_time,
                  candle.open,
                  candle.high,
                  candle.low,
                  candle.close,
                  candle.volume
                );
              });

              await this.candleImporter.insertThrottledCandles(
                candleSticks.map((candle: any) => {
                  return ExchangeCandlestick.createFromCandle(me.getName(), symbol.symbol, period, candle);
                })
              );
              resolve();
            });
          });
        });
      });
    });
  }

  /**
   * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
   *
   * @param positions Position in raw json from Bitmex
   */
  fullPositionsUpdate(positions: any[]): void {
    const openPositions: any[] = [];

    for (const positionItem of positions) {
      const position = positionItem.data;

      if (position.symbol in this.positions && !['buy', 'sell'].includes(position.side.toLowerCase())) {
        delete this.positions[position.symbol];
        continue;
      }

      openPositions.push(position);
    }

    const currentPositions: Record<string, Position> = {};

    for (const position of Bybit.createPositionsWithOpenStateOnly(openPositions)) {
      currentPositions[position.symbol] = position;
    }

    this.logger.debug(`Bybit: Positions via API updated: ${Object.keys(currentPositions).length}`);
    this.positions = currentPositions;
  }

  /**
   * Updates all position; must be a full update not delta. Unknown current non orders are assumed to be closed
   *
   * @param orders Orders in raw json from Bitmex
   */
  fullOrdersUpdate(orders: any[]): void {
    const ourOrders: Record<string, ExchangeOrder> = {};
    for (const order of Bybit.createOrders(orders).filter((order: ExchangeOrder) => order.status === 'open')) {
      ourOrders[order.id] = order;
    }

    this.orders = ourOrders;
  }

  async getOrders(): Promise<ExchangeOrder[]> {
    const orders: ExchangeOrder[] = [];

    for (const key in this.orders) {
      if (this.orders[key].status === 'open') {
        orders.push(this.orders[key]);
      }
    }

    return orders;
  }

  async findOrderById(id: string | number): Promise<ExchangeOrder | undefined> {
    return (await this.getOrders()).find(order => order.id === id || order.id == id);
  }

  async getOrdersForSymbol(symbol: string): Promise<ExchangeOrder[]> {
    return (await this.getOrders()).filter(order => order.symbol === symbol);
  }

  async getPositions(): Promise<Position[]> {
    const results: Position[] = [];

    for (const x in this.positions) {
      let position = this.positions[x];
      if (position.entry && this.tickers[position.symbol]) {
        if (position.side === 'long') {
          position = Position.createProfitUpdate(position, (this.tickers[position.symbol].bid / position.entry - 1) * 100);
        } else if (position.side === 'short') {
          position = Position.createProfitUpdate(position, (position.entry / this.tickers[position.symbol].ask - 1) * 100);
        }
      }

      results.push(position);
    }

    return results;
  }

  async getPositionForSymbol(symbol: string): Promise<Position | undefined> {
    for (const position of await this.getPositions()) {
      if (position.symbol === symbol) {
        return position;
      }
    }

    return undefined;
  }

  /**
   * LTC: 0.008195 => 0.00820
   *
   * @param price
   * @param symbol
   * @returns {number|undefined}
   */
  calculatePrice(price: number, symbol: string): number | undefined {
    const tickSize = this.tickSizes[symbol];
    if (tickSize === undefined) {
      return undefined;
    }

    return parseFloat(String(orderUtil.calculateNearestSize(price, tickSize)));
  }

  /**
   * Force an order update only if order is "not closed" for any reason already by exchange
   *
   * @param order
   */
  triggerOrder(order: ExchangeOrder): void {
    if (!(order instanceof ExchangeOrder)) {
      throw new Error('Invalid order given');
    }

    // dont overwrite state closed order
    if (order.id in this.orders && ['done', 'canceled'].includes(this.orders[order.id].status)) {
      delete this.orders[order.id];
      return;
    }

    this.orders[order.id] = order;
  }

  /**
   * LTC: 0.65 => 1
   *
   * @param amount
   * @param symbol
   * @returns {number|undefined}
   */
  calculateAmount(amount: number, symbol: string): number | undefined {
    const lotSize = this.lotSizes[symbol];
    if (lotSize === undefined) {
      return undefined;
    }

    return parseFloat(String(orderUtil.calculateNearestSize(amount, lotSize)));
  }

  getName(): string {
    return 'bybit';
  }

  async order(order: Order): Promise<ExchangeOrder | undefined> {
    const parameters = Bybit.createOrderBody(order);

    parameters.api_key = this.apiKey;
    parameters.timestamp = new Date().getTime();

    // disabled: bind error on api
    // delete parameters['reduce_only']

    // limit and stops have different api endpoints
    const isConditionalOrder = this.isConditionalExchangeOrder(order);

    if (isConditionalOrder) {
      if (!this.tickers[order.getSymbol()]) {
        this.logger.error('Bybit: base_price based on ticker for conditional not found');
        return undefined;
      }

      // current ticker price is required on this api
      parameters.base_price = this.tickers[order.getSymbol()].bid;
    }

    const parametersSorted: Record<string, any> = {};
    Object.keys(parameters)
      .sort()
      .forEach((key: string) => {
        parametersSorted[key] = parameters[key];
      });

    parametersSorted.sign = crypto.createHmac('sha256', this.apiSecret!).update(querystring.stringify(parametersSorted)).digest('hex');

    let url: string;
    if (isConditionalOrder) {
      url = `${this.getBaseUrl()}/v2/private/stop-order/create`;
    } else {
      url = `${this.getBaseUrl()}/v2/private/order/create`;
    }

    await this.updateLeverage(order.getSymbol());

    const result = await this.requestClient.executeRequestRetry(
      {
        method: 'POST',
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(parametersSorted)
      },
      (r: any) => {
        return r && r.response && r.response.statusCode >= 500;
      }
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      this.logger.error(`Bybit: Invalid order create:${JSON.stringify([error, body])}`);
      return ExchangeOrder.createCanceledFromOrder(order);
    }

    const json = JSON.parse(body);
    if (!json.result) {
      this.logger.error(`Bybit: Invalid order create body:${JSON.stringify([body, parametersSorted])}`);
      return ExchangeOrder.createCanceledFromOrder(order);
    }

    let returnOrder: ExchangeOrder | undefined;
    Bybit.createOrders([json.result]).forEach((o: ExchangeOrder) => {
      this.triggerOrder(o);
      returnOrder = o;
    });

    if (!isConditionalOrder && returnOrder) {
      const restOrder = await this.validatePlacedOrder(returnOrder);
      if (restOrder) {
        returnOrder = restOrder;
      }
    }

    return returnOrder;
  }

  /**
   * In case the order was not able to place we need to wait some "ms" and call order via API again
   * @TODO use the websocket event
   *
   * @param order
   * @returns {Promise<ExchangeOrder | undefined>}
   */
  validatePlacedOrder(order: ExchangeOrder): Promise<ExchangeOrder | undefined> {
    return new Promise(resolve => {
      setTimeout(async () => {
        // calling a direct "order_id" is not given any result
        // we fetch latest order and find our id
        const parameters2: Record<string, any> = {
          api_key: this.apiKey,
          timestamp: new Date().getTime(),
          symbol: order.symbol,
          limit: 5
        };

        const parametersSorted2: Record<string, any> = {};
        Object.keys(parameters2)
          .sort()
          .forEach((key: string) => (parametersSorted2[key] = parameters2[key]));

        parametersSorted2.sign = crypto.createHmac('sha256', this.apiSecret!).update(querystring.stringify(parametersSorted2)).digest('hex');

        const url1 = `${this.getBaseUrl()}/v2/private/order/list?${querystring.stringify(parametersSorted2)}`;
        const placedOrder = await this.requestClient.executeRequestRetry(
          {
            method: 'GET',
            url: url1,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            }
          },
          (r: any) => {
            return r && r.response && r.response.statusCode >= 500;
          }
        );

        const { body } = placedOrder;

        const json = JSON.parse(body);
        if (!json.result || !json.result.data) {
          this.logger.error(`Bybit: Invalid order body:${JSON.stringify({ body: body })}`);
          resolve(undefined);
          return;
        }

        const find = json.result.data.find((o: any) => (o.order_id = order.id));
        if (!find) {
          this.logger.error(`Bybit: Order not found:${JSON.stringify({ body: body })}`);
          resolve(undefined);
          return;
        }

        const orders = Bybit.createOrders([find]);
        resolve(orders[0]);
      }, 1000);
    });
  }

  /**
   * Set the configured leverage size "0-100" for pair before creating an order default "5" if not provided in configuration
   *
   * symbol configuration via:
   *
   * "extra.bybit_leverage": 5
   *
   * @param symbol
   */
  async updateLeverage(symbol: string): Promise<void> {
    const config = this.symbols.find((cSymbol: any) => cSymbol.symbol === symbol);
    if (!config) {
      this.logger.error(`Bybit: Invalid leverage config for:${symbol}`);
      return;
    }

    // use default leverage to "3"
    const leverageSize = _.get(config, 'extra.bybit_leverage', 5);
    if (leverageSize < 0 || leverageSize > 100) {
      throw new Error(`Invalid leverage size for: ${leverageSize} ${symbol}`);
    }

    // we dont get the selected leverage value in websocket or api endpoints
    // so we update them only in a given time window; system overload is often blocked
    if (symbol in this.leverageUpdated && this.leverageUpdated[symbol] > moment().subtract(45, 'minutes').toDate()) {
      this.logger.debug(`Bybit: leverage update not needed: ${symbol}`);
      return;
    }

    if (await this.getPositionForSymbol(symbol)) {
      this.logger.debug(`Bybit: leverage update with open position not needed: ${symbol}`);
      return;
    }

    const parameters: Record<string, any> = {
      api_key: this.apiKey,
      leverage: leverageSize,
      symbol: symbol,
      timestamp: new Date().getTime()
    };

    parameters.sign = crypto.createHmac('sha256', this.apiSecret!).update(querystring.stringify(parameters)).digest('hex');

    const result = await this.requestClient.executeRequestRetry(
      {
        method: 'POST',
        url: `${this.getBaseUrl()}/user/leverage/save`,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(parameters)
      },
      (r: any) => {
        return r && r.response && r.response.statusCode >= 500;
      }
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      this.logger.error(`Bybit: Invalid leverage update request:${JSON.stringify({ error: error, body: body })}`);
      return;
    }

    const json = JSON.parse(body);
    if (json.ret_msg === 'ok' || json.ret_code === 0) {
      this.logger.debug(`Bybit: Leverage update:${JSON.stringify(symbol)}`);
      // set updated indicator; for not update on next request
      this.leverageUpdated[symbol] = new Date();
      return;
    }

    this.logger.error(`Bybit: Leverage update error invalid body:${body}`);
  }

  async cancelOrder(id: string | number): Promise<ExchangeOrder | undefined> {
    const order = await this.findOrderById(id);
    if (!order) {
      return undefined;
    }

    const isConditionalOrder = this.isConditionalExchangeOrder(order);

    const parameters: Record<string, any> = {
      api_key: this.apiKey,
      [isConditionalOrder ? 'stop_order_id' : 'order_id']: id,
      symbol: order.getSymbol(),
      timestamp: new Date().getTime()
    };

    parameters.sign = crypto.createHmac('sha256', this.apiSecret!).update(querystring.stringify(parameters)).digest('hex');

    let url: string;
    if (isConditionalOrder) {
      url = `${this.getBaseUrl()}/v2/private/stop-order/cancel?${querystring.stringify(parameters)}`;
    } else {
      url = `${this.getBaseUrl()}/v2/private/order/cancel?${querystring.stringify(parameters)}`;
    }

    const result = await this.requestClient.executeRequestRetry(
      {
        method: 'post',
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify(parameters)
      },
      (r: any) => {
        return r && r.response && r.response.statusCode >= 500;
      }
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      this.logger.error(`Bybit: Invalid order cancel:${JSON.stringify({ error: error, body: body })}`);
      return undefined;
    }

    const json = JSON.parse(body);
    if (!json.result) {
      this.logger.error(`Bybit: Invalid order cancel body:${JSON.stringify({ body: body, id: order })}`);
      return undefined;
    }

    if (id !== json.result.order_id && id !== json.result.stop_order_id) {
      this.logger.error(`Bybit: Invalid order cancel body:${JSON.stringify({ body: body, id: order })}`);
      return undefined;
    }

    const exchangeOrder = ExchangeOrder.createCanceled(order);
    this.triggerOrder(exchangeOrder);

    return exchangeOrder;
  }

  isConditionalExchangeOrder(order: ExchangeOrder | Order): boolean {
    const orderType = order instanceof ExchangeOrder ? order.getType() : order.getType();
    return [ExchangeOrder.TYPE_STOP, ExchangeOrder.TYPE_STOP_LIMIT].includes(orderType);
  }

  async cancelAll(symbol: string): Promise<(ExchangeOrder | undefined)[]> {
    const orders: (ExchangeOrder | undefined)[] = [];

    for (const order of await this.getOrdersForSymbol(symbol)) {
      orders.push(await this.cancelOrder(order.id));
    }

    return orders;
  }

  async updateOrder(id: string | number, order: Partial<Pick<Order, 'amount' | 'price'>>): Promise<ExchangeOrder | undefined> {
    if (!order.amount && !order.price) {
      throw new Error('Invalid amount / price for update');
    }

    const currentOrder = await this.findOrderById(id);
    if (!currentOrder) {
      return undefined;
    }

    // cancel order; mostly it can already be canceled
    await this.cancelOrder(id);

    return this.order(Order.createUpdateOrderOnCurrent(currentOrder, order.price, order.amount)) as Promise<ExchangeOrder | undefined>;
  }

  /**
   * Convert incoming positions only if they are open
   *
   * @param positions
   * @returns {Position[]}
   */
  static createPositionsWithOpenStateOnly(positions: any[]): Position[] {
    return positions
      .filter((position: any) => {
        return ['buy', 'sell'].includes(position.side.toLowerCase());
      })
      .map((position: any) => {
        const side = position.side.toLowerCase() === 'buy' ? 'long' : 'short';
        let { size } = position;

        if (side === 'short') {
          size *= -1;
        }

        return new Position(
          position.symbol,
          side,
          size,
          position.unrealised_pnl && position.position_value ? parseFloat(((position.unrealised_pnl / position.position_value) * 100).toFixed(2)) : null,
          new Date(),
          parseFloat(position.entry_price),
          new Date()
        );
      });
  }

  static createOrders(orders: any[]): ExchangeOrder[] {
    return orders.map((originOrder: any) => {
      const order = originOrder;

      // some endpoints / websocket request merge extra field into nested "ext_fields"; just merge them into main
      for (const [key, value] of Object.entries(order.ext_fields || {})) {
        // dont overwrite?
        if (key in order) {
          continue;
        }

        order[key] = value;
      }

      let retry = false;

      let status: ExchangeOrderStatus;

      let orderStatus: string | undefined;
      let orderType = ExchangeOrder.TYPE_UNKNOWN;

      if (order.order_status) {
        orderStatus = order.order_status.toLowerCase();
      } else if (order.stop_order_status && order.stop_order_status.toLowerCase() === 'untriggered') {
        orderStatus = 'new';
        orderType = ExchangeOrder.TYPE_STOP;
      }

      // via websocket; conditional is different here
      if (order.stop_order_type) {
        orderType = ExchangeOrder.TYPE_STOP;
      }

      if (['new', 'partiallyfilled', 'pendingnew', 'doneforday', 'stopped', 'created', 'untriggered'].includes(orderStatus!)) {
        status = 'open';
      } else if (orderStatus === 'filled') {
        status = 'done';
      } else if (orderStatus === 'canceled' || orderStatus === 'cancelled' || orderStatus === 'deactivated') {
        status = 'canceled';
      } else if (orderStatus === 'rejected' || orderStatus === 'expired') {
        status = 'rejected';
        retry = true;
      } else {
        status = 'open';
      }

      const ordType = order.order_type.toLowerCase();

      // secure the value
      switch (ordType) {
        case 'limit':
          orderType = ExchangeOrder.TYPE_LIMIT;
          break;
        case 'stop':
          orderType = ExchangeOrder.TYPE_STOP;
          break;
      }

      if (orderType === ExchangeOrder.TYPE_LIMIT && order.stop_px && parseFloat(order.stop_px) > 0) {
        orderType = ExchangeOrder.TYPE_STOP_LIMIT;
      }

      // new format
      if (orderType === ExchangeOrder.TYPE_LIMIT && order.stop_order_type === 'Stop') {
        orderType = ExchangeOrder.TYPE_STOP_LIMIT;
      }

      let { price } = order;
      if (orderType === ExchangeOrder.TYPE_STOP) {
        // old stuff; can be dropped?
        price = parseFloat(order.stop_px || undefined);

        // new format
        if (!price || price === 0) {
          price = parseFloat(order?.trigger_price);
        }
      }

      const options: Record<string, any> = {};
      if (order.reduce_only === true || order.ext_fields?.reduce_only === true) {
        options.reduce_only = true;
      }

      let createdAt: Date;
      if (order.timestamp) {
        createdAt = new Date(order.timestamp);
      } else if (order.created_at) {
        createdAt = new Date(order.created_at);
      } else if (order.created_time) {
        createdAt = new Date(isNaN(order.created_time) ? order.created_time : parseInt(order.created_time));
      } else {
        createdAt = new Date();
      }

      let orderId: string | number;
      if (order.order_id) {
        orderId = order.order_id;
      } else if (order.stop_order_id) {
        orderId = order.stop_order_id;
      } else {
        orderId = '';
      }

      if (!price || price === 0) {
        throw new Error(`Bybit: Invalid exchange order price:${JSON.stringify([order])}`);
      }

      return new ExchangeOrder(
        orderId,
        order.symbol,
        status,
        price,
        order.qty,
        retry,
        order.order_link_id ? order.order_link_id : undefined,
        order.side.toLowerCase() === 'sell' ? 'sell' : 'buy', // secure the value,
        orderType,
        createdAt,
        new Date(),
        JSON.parse(JSON.stringify(order)),
        options
      );
    });
  }

  /**
   * As a websocket fallback update positions also on REST
   */
  async syncOrdersViaRestApi(symbols: string[]): Promise<void> {
    const promises: Array<() => Promise<any>> = [];

    symbols.forEach(symbol => {
      // there is not full active order state; we need some more queries
      ['Created', 'New', 'PartiallyFilled'].forEach(orderStatus => {
        promises.push(async () => {
          const parameter: Record<string, any> = {
            api_key: this.apiKey,
            limit: 100,
            order_status: orderStatus,
            symbol: symbol,
            timestamp: new Date().getTime() // 1 min in the future
          };

          parameter.sign = crypto.createHmac('sha256', this.apiSecret!).update(querystring.stringify(parameter)).digest('hex');

          const url = `${this.getBaseUrl()}/v2/private/order/list?${querystring.stringify(parameter)}`;
          const result = await this.requestClient.executeRequestRetry(
            {
              url: url,
              headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
              }
            },
            (r: any) => {
              return r && r.response && r.response.statusCode >= 500;
            }
          );

          const { error } = result;
          const { response } = result;
          const { body } = result;

          if (error || !response || response.statusCode !== 200) {
            this.logger.error(
              `Bybit: Invalid orders response:${JSON.stringify({
                error: error,
                body: body,
                orderStatus: orderStatus
              })}`
            );

            throw new Error();
          }

          let json;
          try {
            json = JSON.parse(body);
          } catch (e) {
            json = [];
          }

          if (!json.result || !json.result.data) {
            this.logger.error(`Bybit: Invalid orders json:${JSON.stringify({ body: body })}`);

            throw new Error('Invalid orders json');
          }

          return json.result.data;
        });
      });

      // stop order are special endpoint
      promises.push(async () => {
        const parameter: Record<string, any> = {
          api_key: this.apiKey,
          limit: 100,
          symbol: symbol,
          timestamp: new Date().getTime()
        };

        parameter.sign = crypto.createHmac('sha256', this.apiSecret!).update(querystring.stringify(parameter)).digest('hex');

        const url = `${this.getBaseUrl()}/v2/private/stop-order/list?${querystring.stringify(parameter)}`;
        const result = await this.requestClient.executeRequestRetry(
          {
            url: url,
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json'
            }
          },
          (r: any) => {
            return r && r.response && r.response.statusCode >= 500;
          }
        );

        const { error } = result;
        const { response } = result;
        const { body } = result;

        if (error || !response || response.statusCode !== 200) {
          this.logger.error(`Bybit: Invalid order update: ${symbol} - ${JSON.stringify({ error: error, body: body })}`);

          return [];
        }

        let json;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = [];
        }

        if (!json.result || !json.result.data) {
          this.logger.error(`Bybit: Invalid stop-order json: ${symbol} - ${JSON.stringify({ body: body })}`);
          return [];
        }

        return json.result.data.filter((o: any) => o.stop_order_status === 'Untriggered');
      });
    });

    let results;
    try {
      results = await Promise.all(promises.map(fn => fn()));
    } catch (e: any) {
      this.logger.error(`Bybit: Orders via API updated stopped: ${e.message}`);
      return;
    }

    const orders: any[] = [];
    results.forEach((order: any) => {
      orders.push(...order);
    });

    this.logger.debug(`Bybit: Orders via API updated: ${orders.length}`);
    this.fullOrdersUpdate(orders);
  }

  /**
   * As a websocket fallback update orders also on REST
   */
  async syncPositionViaRestApi(): Promise<void> {
    const parameter: Record<string, any> = {
      api_key: this.apiKey,
      timestamp: new Date().getTime() // 1 min in the future
    };

    parameter.sign = crypto.createHmac('sha256', this.apiSecret!).update(querystring.stringify(parameter)).digest('hex');

    const url = `${this.getBaseUrl()}/v2/private/position/list?${querystring.stringify(parameter)}`;
    const result = await this.requestClient.executeRequestRetry(
      {
        url: url,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      },
      (r: any) => {
        return r && r.response && r.response.statusCode >= 500;
      }
    );

    const { error } = result;
    const { response } = result;
    const { body } = result;

    if (error || !response || response.statusCode !== 200) {
      this.logger.error(`Bybit: Invalid position update:${JSON.stringify({ error: error, body: body })}`);
      return;
    }

    const json = JSON.parse(body);
    if (!json.result) {
      this.logger.error(`Bybit: Invalid position update:${JSON.stringify({ body: body })}`);
      return;
    }

    this.fullPositionsUpdate(json.result);
  }

  /**
   * Create a REST API body for Bitmex based on our internal order
   *
   * @param order
   * @returns {Record<string, any>}
   */
  static createOrderBody(order: Order): Record<string, any> {
    if (!order.getAmount() && !order.getPrice() && !order.getSymbol()) {
      throw new Error('Invalid amount for update');
    }

    let orderType: string | undefined;

    const ourOrderType = order.getType();
    if (!ourOrderType) {
      orderType = 'Limit';
    } else if (ourOrderType === 'limit') {
      orderType = 'Limit';
    } else if (ourOrderType === 'stop') {
      orderType = 'Stop';
    } else if (ourOrderType === 'market') {
      orderType = 'Market';
    }

    if (!orderType) {
      throw new Error('Invalid order type');
    }

    const body: Record<string, any> = {
      symbol: order.getSymbol(),
      qty: order.getAmount(),
      order_type: orderType,
      time_in_force: 'GoodTillCancel'
    };

    if (order.isPostOnly()) {
      body.time_in_force = 'PostOnly';
    }

    if (order.options && order.options.close === true && orderType === 'Limit') {
      body.reduce_only = true;
    }

    if (order.options && order.options.close === true && orderType === 'Stop') {
      body.close_on_trigger = true;
    }

    if (orderType === 'Stop') {
      body.stop_px = order.getPrice();
    } else if (orderType === 'Limit') {
      body.price = order.getPrice();
    }

    body.side = order.isShort() ? 'Sell' : 'Buy';

    if (order.id) {
      body.order_link_id = order.getId();
    }

    // conditional stop is market
    if (orderType === 'Stop') {
      body.order_type = 'Market';
    }

    return body;
  }

  getBaseUrl(): string {
    return 'https://api.bybit.com';
  }

  isInverseSymbol(symbol: string): boolean {
    return true;
  }
}

export default Bybit;
