'use strict';

const Order = require('../../dict/order');
const PairState = require('../../dict/pair_state');
const ExchangeOrder = require('../../dict/exchange_order');
const _ = require('lodash');
const moment = require('moment');

module.exports = class OrderExecutor {
    constructor(exchangeManager, tickers, systemUtil, logger, pairStateManager) {
        this.pairStateManager = pairStateManager;
        this.exchangeManager = exchangeManager;
        this.tickers = tickers;
        this.logger = logger;
        this.systemUtil = systemUtil;
        this.runningOrders = {};

        this.tickerPriceInterval = 200;
        this.tickerPriceRetries = 40;
    }

    /**
     * Keep open orders in orderbook at first position
     */
    adjustOpenOrdersPrice() {
        for (let orderId in this.runningOrders) {
            if (this.runningOrders[orderId] < moment().subtract(2, 'minutes')) {
                delete this.runningOrders[orderId]
            }
        }

        let visitExchangeOrder = async pairState => {
            if (!pairState.hasAdjustedPrice()) {
                return;
            }

            let exchange = this.exchangeManager.get(pairState.getExchange());

            let exchangeOrder = pairState.getExchangeOrder();
            if (!exchangeOrder) {
                return;
            }

            if (exchangeOrder.id in this.runningOrders) {
                this.logger.info('OrderAdjust: already running: ' + JSON.stringify([exchangeOrder.id, pairState.getExchange(), pairState.getSymbol()]));
                return
            }

            // order not known by exchange cleanup
            let lastExchangeOrder = await exchange.findOrderById(exchangeOrder.id);
            if (!lastExchangeOrder || lastExchangeOrder.status !== ExchangeOrder.STATUS_OPEN) {
                this.logger.debug('OrderAdjust: managed order does not exists maybe filled; cleanup: ' + JSON.stringify([exchangeOrder.id, pairState.getExchange(), pairState.getSymbol(), lastExchangeOrder]));
                return
            }

            this.runningOrders[exchangeOrder.id] = new Date();

            let price = await this.getCurrentPrice(pairState.getExchange(), pairState.getSymbol(), exchangeOrder.getLongOrShortSide());
            if (!price) {
                this.logger.info('OrderAdjust: No up to date ticker price found: ' + JSON.stringify([exchangeOrder.id, pairState.getExchange(), pairState.getSymbol(), order.side]));

                delete this.runningOrders[exchangeOrder.id];

                return
            }

            let orderUpdate = Order.createPriceUpdateOrder(exchangeOrder.id, price);

            // normalize prices for positions compare; we can have negative prices depending on "side"
            if (Math.abs(lastExchangeOrder.price) === Math.abs(price)) {
                this.logger.info('OrderAdjust: No price update needed:' + JSON.stringify([lastExchangeOrder.id, Math.abs(lastExchangeOrder.price), Math.abs(price), pairState.getExchange(), pairState.getSymbol()]));
                delete this.runningOrders[exchangeOrder.id];

                return
            }

            try {
                let updatedOrder = await exchange.updateOrder(orderUpdate.id, orderUpdate);

                if (updatedOrder && updatedOrder.status === ExchangeOrder.STATUS_OPEN) {
                    this.logger.info('OrderAdjust: Order adjusted with orderbook price: ' + JSON.stringify([updatedOrder.id, Math.abs(lastExchangeOrder.price), Math.abs(price), pairState.getExchange(), pairState.getSymbol(), updatedOrder]))
                    pairState.setExchangeOrder(updatedOrder)
                } else if (updatedOrder && updatedOrder.status === ExchangeOrder.STATUS_CANCELED && updatedOrder.retry === true) {
                    // we update the price outside the orderbook price range on PostOnly we will cancel the order directly
                    this.logger.error('OrderAdjust: Updated order canceled recreate: ' + JSON.stringify(pairState, updatedOrder));

                    // recreate order
                    // @TODO: resync used balance in case on order is partially filled

                    let amount = lastExchangeOrder.getLongOrShortSide() === ExchangeOrder.SIDE_LONG
                        ? Math.abs(lastExchangeOrder.amount)
                        : Math.abs(lastExchangeOrder.amount) * -1;

                    // create a retry order with the order amount we had before; eg if partially filled
                    let retryOrder = pairState.getState() === PairState.STATE_CLOSE
                        ? Order.createCloseOrderWithPriceAdjustment(pairState.getSymbol(), amount)
                        : Order.createLimitPostOnlyOrderAutoAdjustedPriceOrder(pairState.getSymbol(), amount);

                    this.logger.error('OrderAdjust: replacing canceled order: ' + JSON.stringify(retryOrder));

                    let exchangeOrder = await this.executeOrder(pairState.getOrder(), retryOrder);
                    pairState.setExchangeOrder(exchangeOrder)
                } else {
                    this.logger.error('OrderAdjust: Unknown order state: ' + JSON.stringify([pairState, updatedOrder]))
                }
            } catch (err) {
                this.logger.error('OrderAdjust: adjusted failed: ' + JSON.stringify([String(err), pairState, orderUpdate]))
            }

            delete this.runningOrders[exchangeOrder.id]
        };

        return Promise.all(this.pairStateManager.all().map(pairState => {
            return visitExchangeOrder(pairState)
        }))
    }

    executeOrder(exchangeName, order) {
        return new Promise(async resolve => {
            await this.triggerOrder(resolve, exchangeName, order)
        })
    }

    async cancelOrder(exchangeName, orderId) {
        let exchange = this.exchangeManager.get(exchangeName);
        if (!exchange) {
            console.error('Invalid exchange: ' + exchangeName);
            return;
        }

        try {
            let order = await exchange.cancelOrder(orderId)
            this.logger.info('Order canceled: ' + orderId);
            return order
        } catch (err) {
            this.logger.error('Order cancel error: ' + orderId + ' ' + err);
        }
    }

    async cancelAll(exchangeName, symbol) {
        let exchange = this.exchangeManager.get(exchangeName);

        try {
            return await exchange.cancelAll(symbol)
        } catch (err) {
            this.logger.error('Order cancel all error: ' + JSON.stringify([symbol, err]));
        }
    }

    async triggerOrder(resolve, exchangeName, order, retry = 0) {
        if (retry > this.systemUtil.getConfig('order.retry', 4)) {
            this.logger.error(`Retry (${retry}) creating order reached: ` + JSON.stringify(order));
            resolve();
            return
        }

        if (retry > 0) {
            this.logger.info(`Retry (${retry}) creating order: ` + JSON.stringify(order))
        }

        let exchange = this.exchangeManager.get(exchangeName);
        if (!exchange) {
            console.error('Invalid exchange: ' + exchangeName);

            resolve();
            return
        }

        if (order.hasAdjustedPrice() === true) {
            order = await this.createAdjustmentOrder(exchangeName, order);

            if (!order) {
                this.logger.error('Order price adjust failed:' + JSON.stringify([exchangeName, order]));
                resolve();
                return
            }
        }

        let exchangeOrder = undefined;
        try {
            exchangeOrder = await exchange.order(order)
        } catch (err) {
            this.logger.error('Order create canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(String(err)));

            resolve();
            return
        }

        if (!exchangeOrder) {
            this.logger.error('Order create canceled no exchange return');

            resolve();
            return
        }

        if (exchangeOrder.status === 'canceled' && exchangeOrder.retry === false) {
            this.logger.error('Order create canceled:' + JSON.stringify(order) + ' - ' + JSON.stringify(exchangeOrder));

            resolve(exchangeOrder);
            return
        }

        if (exchangeOrder.retry === true) {
            this.logger.info('Order not placed force retry: ' + JSON.stringify(exchangeOrder));

            setTimeout(async () => {
                let retryOrder = Order.createRetryOrder(order);

                await this.triggerOrder(resolve, exchangeName, retryOrder, ++retry)
            }, this.systemUtil.getConfig('order.retry_ms', 1500));

            return
        }

        this.logger.info('Order created: ' + JSON.stringify([exchangeOrder.id, exchangeName, exchangeOrder.symbol, order, exchangeOrder]));
        console.log('Order created: ' + JSON.stringify([exchangeOrder.id, exchangeName, exchangeOrder.symbol]));

        resolve(exchangeOrder)
    }

    /**
     * Follow orderbook aks / bid to be the first on the list
     *
     * @param exchangeName
     * @param order
     * @returns {Promise<*>}
     */
    createAdjustmentOrder(exchangeName, order) {
        return new Promise(async resolve => {
            let price = await this.getCurrentPrice(exchangeName, order.symbol, order.side);
            if (!price) {
                this.logger.error('Stop creating order; can not find up to date ticker price: ' + JSON.stringify([exchangeName, order.symbol, order.side]));
                resolve();
                return
            }

            resolve(Order.createRetryOrderWithPriceAdjustment(order, price))
        })
    }

    /**
     * Get current price based on the ticker. This function is block and waiting until getting an up to date ticker price
     *
     * @param exchangeName
     * @param symbol
     * @param side
     * @returns {Promise<any>}
     */
    getCurrentPrice(exchangeName, symbol, side) {
        if (!['long', 'short'].includes(side)) {
            throw 'Invalid side: ' + side
        }

        return new Promise(async resolve => {
            let wait = (time) => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, time);
                });
            };

            let ticker = undefined;

            for (let retry = 0; retry < this.tickerPriceRetries; retry++) {
                ticker = this.tickers.getIfUpToDate(exchangeName, symbol, 10000);
                if (ticker) {
                    break
                }

                await wait(this.tickerPriceInterval)
            }

            // fallback
            if (!ticker) {
                ticker = this.tickers.get(exchangeName, symbol)
            }

            if (!ticker) {
                this.logger.error('OrderExecutor: ticker price not found: ' + JSON.stringify([exchangeName, symbol, side]));
                resolve();
                return
            }

            let price = ticker.bid;
            if (side === 'short') {
                price = ticker.ask * -1
            }

            resolve(price)
        })
    }
};
