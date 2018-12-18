'use strict';

let orderUtil = require('../../utils/order_util')
let Order = require('../../dict/order')

module.exports = class ExchangeOrderWatchdogListener {
    constructor(exchangeManager, instances, stopLossCalculator, riskRewardRatioCalculator, orderExecutor, pairStateManager, logger) {
        this.exchangeManager = exchangeManager
        this.instances = instances
        this.stopLossCalculator = stopLossCalculator
        this.riskRewardRatioCalculator = riskRewardRatioCalculator
        this.orderExecutor = orderExecutor
        this.pairStateManager = pairStateManager
        this.logger = logger
    }

    onTick() {
        let instances = this.instances

        this.exchangeManager.all().forEach(async exchange => {
            let positions = await exchange.getPositions()

            if (positions.length === 0) {
                return
            }

            positions.forEach(async position => {
                let pair = instances.symbols.find(
                    instance => instance.exchange === exchange.getName() && instance.symbol === position.symbol
                )

                if (!pair || !pair.watchdogs) {
                    return
                }

                if (!this.pairStateManager.isNeutral(exchange.getName(), position.symbol)) {
                    this.logger.debug('Watchdog: block for action in place: ' + JSON.stringify({
                        'exchange': exchange.getName(),
                        'symbol':  position.symbol,
                    }))

                    return
                }

                let stopLoss = pair.watchdogs.find(watchdog => watchdog.name === 'stoploss')
                if(stopLoss) {
                    await this.stopLossWatchdog(exchange, position, stopLoss)
                }

                let riskRewardRatio = pair.watchdogs.find(watchdog => watchdog.name === 'risk_reward_ratio')
                if (riskRewardRatio) {
                    await this.riskRewardRatioWatchdog(exchange, position, riskRewardRatio)
                }
            })
        })
    }

    async stopLossWatchdog(exchange, position, stopLoss) {
        let logger = this.logger
        let stopLossCalculator = this.stopLossCalculator

        let orders = await exchange.getOrdersForSymbol(position.symbol);
        let orderChanges = orderUtil.syncStopLossOrder(position, orders);

        orderChanges.forEach(async orderChange => {
            logger.info('Stoploss update: ' + JSON.stringify({
                'order': orderChange,
                'symbol': position.symbol,
                'exchange': exchange.getName(),
            }))

            if (orderChange.id) {
                // update
                exchange.updateOrder(orderChange.id, {
                    'amount': orderChange.amount,
                })
            } else {
                // create

                let price = await stopLossCalculator.calculateForOpenPosition(exchange.getName(), position, stopLoss)
                if (!price) {
                    console.log('Stop loss: auto price skipping')
                    return
                }

                price = exchange.calculatePrice(price, position.symbol)
                if (!price) {
                    console.log('Stop loss: auto price skipping')
                    return
                }

                let order = Order.createStopLossOrder(position.symbol, price, orderChange.amount)

                try {
                    await exchange.order(order)
                } catch(e) {
                    let msg = 'Stoploss create' + JSON.stringify({
                        'error': e,
                        'order': order,
                    });

                    logger.error(msg)
                    console.error(msg)
                }
            }
        })
    }

    async riskRewardRatioWatchdog(exchange, position, riskRewardRatioOptions) {
        let logger = this.logger

        let orders = await exchange.getOrdersForSymbol(position.symbol)
        let orderChanges = await this.riskRewardRatioCalculator.createRiskRewardOrdersOrders(position, orders, riskRewardRatioOptions)

        orderChanges.forEach(async order => {
            logger.info('Risk Reward: order update: ' + JSON.stringify({
                'order': order,
                'symbol': position.symbol,
                'exchange': exchange.getName(),
            }))

            let price = exchange.calculatePrice(order.price, order.symbol)
            if (!price) {
                logger.error('Risk Reward: Invalid price: ' + JSON.stringify({
                    'order': order,
                    'symbol': position.symbol,
                    'exchange': exchange.getName(),
                }))

                return
            }

            // we need to normalize the price here: more general solution?
            order.price = price

            await this.orderExecutor.executeOrder(exchange.getName(), order)
        })
    }
}
