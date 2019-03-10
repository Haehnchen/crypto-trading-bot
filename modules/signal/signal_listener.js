'use strict';

let Order = require('../../dict/order')
let OrderEvent = require('../../event/order_event')
let orderUtil = require('../../utils/order_util')
var _ = require('lodash');

module.exports = class SignalListener {
    constructor(repository, instances, tickers, eventEmitter) {
        this.repository = repository
        this.instances = instances
        this.tickers = tickers
        this.eventEmitter = eventEmitter
    }

    async onSignalTick() {
        this.instances.symbols.filter(instance =>
            _.get(instance, 'trade.capital', 0) > 0 || _.get(instance, 'trade.currency_capital', 0) > 0
        ).forEach(async (instance) => {
            let signal = await this.repository.getValidSignals(instance.exchange, instance.symbol)

            if(!signal) {
                return
            }

            this.onSignal(signal, instance)
        })
    }

    onSignal(signal, instance) {
        // disabled
        return


        let ticker = this.tickers.get(signal.exchange, signal.symbol);

        if (!ticker) {
            console.error('Ticker no found for + ' + signal.exchange + signal.symbol)
            return;
        }

        let side = signal.side
        let price = undefined

        if (side === 'short') {
            price = ticker.ask

            price = price * 1.03
        } else if(side === 'long') {
            price = ticker.bid

            price = price * 0.97
        }

        if (!(price > 0)) {
            throw 'Invalid price: ' . side
        }

        let order = new Order(
            Math.round(((new Date()).getTime()).toString() * Math.random()),
            signal.symbol,
            side,
            price,
            parseFloat(orderUtil.calculateOrderAmount(price, instance.trade.capital).toFixed(8))
        );

        let e = new OrderEvent(signal.exchange, order)

        //console.log(order)

        //this.notifier.send('Create order: ' + JSON.stringify(e))

        //this.eventEmitter.emit('order', e)
    }
};