'use strict';

let orderUtil = require('../../utils/order_util')

module.exports = class ExchangeOrderWatchdogListener {
    constructor(exchangeManager, instances, logger) {
        this.exchangeManager = exchangeManager
        this.instances = instances
        this.logger = logger
    }

    onTick() {
        let instances = this.instances

        this.exchangeManager.all().forEach(exchange => {
            let positions = exchange.getPositions()

            if (positions.length === 0) {
                return
            }

            positions.forEach((position) => {
                let pair = instances.symbols.find(
                    instance => instance.exchange === exchange.getName() && instance.symbol === position.symbol
                )


                if (!pair || !pair.watchdogs) {
                    return
                }

                let names = pair.watchdogs.map((watchdog) => watchdog.name)

                if (names.indexOf('stoploss') >= 0) {
                    this.stopLossWatchdog(exchange, position)
                }
            })
        })
    }

    async stopLossWatchdog(exchange, position) {
        let logger = this.logger
        let orderChanges = orderUtil.syncStopLossOrder(position, exchange.getOrdersForSymbol(position.symbol));

        orderChanges.forEach(orderChange => {
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

                let price = orderChange.price
                if (!price) {
                    console.log('Stop loss: auto price skipping')
                    return
                }

                try {
                    exchange.order({
                        'symbol': position.symbol,
                        'price': orderChange.price,
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
