'use strict';

let orderUtil = require('../../utils/order_util')

module.exports = class ExchangeOrderWatchdogListener {
    constructor(exchangeManager, instances, stopLossCalculator, logger) {
        this.exchangeManager = exchangeManager
        this.instances = instances
        this.logger = logger
        this.stopLossCalculator = stopLossCalculator
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

                let stopLoss = pair.watchdogs.find(watchdog => watchdog.name === 'stoploss')
                if(stopLoss) {
                    await this.stopLossWatchdog(exchange, position, stopLoss)
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
            logger.info('Stoploss update' + JSON.stringify({
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

                try {
                    exchange.order({
                        'symbol': position.symbol,
                        'price': price,
                        'amount': orderChange.amount,
                        'type': 'stop'
                    })
                } catch(e) {
                    let msg = 'Stoploss update' + JSON.stringify({
                        'error': e,
                    });

                    logger.error(msg)
                    console.error(msg)
                }
            }
        })
    }
}
