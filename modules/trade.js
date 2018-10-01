'use strict';

var moment = require('moment');
const crypto = require('crypto');
const os = require('os');

module.exports = class Trade {
    constructor(
        eventEmitter,
        instances,
        notify,
        logger,
        createOrderListener,
        tickListener,
        candleStickListener,
        tickers,
        candleStickLogListener,
        tickerDatabaseListener,
        tickerLogListener,
        signalListener,
    ) {
        this.eventEmitter = eventEmitter
        this.instances = instances
        this.notify = notify
        this.logger = logger
        this.createOrderListener = createOrderListener
        this.tickListener = tickListener
        this.candleStickListener = candleStickListener
        this.tickers = tickers
        this.candleStickLogListener = candleStickLogListener
        this.tickerDatabaseListener = tickerDatabaseListener
        this.tickerLogListener = tickerLogListener
        this.signalListener = signalListener
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

        /*
        setInterval(() => {
            this.notify.send('Heartbeat: ' + instanceId + ' - ' + os.hostname() + ' - ' + os.platform() + ' - ' + moment().format() + ' - ' + notifyActivePairs.join(', '))
        }, 60 * 60 * 30);
        */

        let eventEmitter = this.eventEmitter

        setInterval(() => {
            eventEmitter.emit('tick', {})
        }, 5000);

        setInterval(() => {
            eventEmitter.emit('signal_tick', {})
        }, 1000);

        let me = this
        let tickers = this.tickers

        eventEmitter.on('ticker', async function(tickerEvent) {
            tickers.set(tickerEvent.ticker)
            me.tickerDatabaseListener.onTicker(tickerEvent)
            me.tickerLogListener.onTicker(tickerEvent)
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

        eventEmitter.on('candlestick', async (event) => {
            me.candleStickListener.onCandleStick(event)
            me.candleStickLogListener.onCandleStick(event)
        })

        eventEmitter.on('order', async (event) => me.createOrderListener.onCreateOrder(event))
        eventEmitter.on('tick', async () => me.tickListener.onTick())
        eventEmitter.on('signal_tick', async () => me.signalListener.onSignalTick())
    }
};