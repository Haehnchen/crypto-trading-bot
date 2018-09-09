'use strict';

var moment = require('moment');
const crypto = require('crypto');
const os = require('os');

module.exports = class Trade {
    constructor(eventEmitter, instances, notify, logger, createOrderListener, tickListener, candleStickListener, tickers) {
        this.eventEmitter = eventEmitter
        this.instances = instances
        this.notify = notify
        this.logger = logger
        this.createOrderListener = createOrderListener
        this.tickListener = tickListener
        this.candleStickListener = candleStickListener
        this.tickers = tickers
    }

    start() {
        this.logger.debug('Trade module started')

        const instanceId = crypto.randomBytes(4).toString('hex');

        let notifyActivePairs = this.instances.symbols.filter((symbol) => {
            return symbol['state'] === 'watch';
        }).map((symbol) => {
            return symbol.exchange + '.' + symbol.symbol
        })

        let message = 'Start: ' + instanceId + ' - ' + os.hostname() + ' - ' + os.platform() + ' - ' + moment().format() + ' - ' + notifyActivePairs.join(', ');

        this.notify.send(message)
        console.log(message)

        /*
        setInterval(() => {
            this.notify.send('Heartbeat: ' + instanceId + ' - ' + os.hostname() + ' - ' + os.platform() + ' - ' + moment().format() + ' - ' + notifyActivePairs.join(', '))
        }, 60 * 60 * 30);
        */

        let eventEmitter = this.eventEmitter

        setInterval(() => {
            eventEmitter.emit('tick', {})
        }, 5000);

        let tickers = this.tickers
        eventEmitter.on('ticker', function(tickerEvent) {
            tickers.set(tickerEvent.ticker)
        });

        eventEmitter.on('orderbook', function(orderbookEvent) {
            //console.log(orderbookEvent.orderbook)
        });

        eventEmitter.on('exchange_order', function(exchangeOrderEvent) {
            console.log(exchangeOrderEvent)
        });

        eventEmitter.on('exchange_orders', function(exchangeOrderEvent) {
            console.log(exchangeOrderEvent)
        });

        let me = this

        eventEmitter.on('candlestick', (event) => me.candleStickListener.onCandleStick(event))
        eventEmitter.on('order', (event) => me.createOrderListener.onCandleStick(event))
        eventEmitter.on('tick', () => me.tickListener.onTick())
    }
};