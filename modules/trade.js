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
        exchangeOrderWatchdogListener,
        orderExecutor,
        pairStateExecution,
        systemUtil,
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
        this.exchangeOrderWatchdogListener = exchangeOrderWatchdogListener
        this.orderExecutor = orderExecutor
        this.pairStateExecution = pairStateExecution
        this.systemUtil = systemUtil
    }

    start() {
        this.logger.debug('Trade module started')

        process.on('SIGINT', async () => {
            // force exit in any case
            setTimeout(() => {
                process.exit()
            }, 7500);

            await this.pairStateExecution.onTerminate()

            process.exit()
        });

        const instanceId = crypto.randomBytes(4).toString('hex');

        let notifyActivePairs = this.instances.symbols.filter((symbol) => {
            return symbol['state'] === 'watch';
        }).map((symbol) => {
            return symbol.exchange + '.' + symbol.symbol
        })

        let message = 'Start: ' + instanceId + ' - ' + os.hostname() + ' - ' + os.platform() + ' - ' + moment().format() + ' - ' + notifyActivePairs.join(', ');

        this.notify.send(message)

        let eventEmitter = this.eventEmitter

        // let the system bootup; eg let the candle be filled by exchanges
        setTimeout(() => {
            console.log('Trade module: warmup done; starting ticks')
            this.logger.info('Trade module: warmup done; starting ticks')

            setInterval(() => {
                eventEmitter.emit('tick', {})
            }, this.systemUtil.getConfig('tick.default', 5500))

            // order create tick
            setInterval(() => {
                eventEmitter.emit('signal_tick', {})
            }, this.systemUtil.getConfig('tick.signal', 3100))

            setInterval(() => {
                eventEmitter.emit('watchdog', {})
            }, this.systemUtil.getConfig('tick.watchdog', 5100))

            setInterval(() => {
                eventEmitter.emit('tick_ordering', {})
            }, this.systemUtil.getConfig('tick.ordering', 5300))
        }, this.systemUtil.getConfig('tick.warmup', 30000));

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
            console.log('exchangeOrderEvent: ' + JSON.stringify(exchangeOrderEvent))
        });

        eventEmitter.on('exchange_orders', function(exchangeOrderEvent) {
            console.log('exchange_orders: ' + JSON.stringify(exchangeOrderEvent))
        });

        eventEmitter.on('candlestick', async (event) => {
            me.candleStickListener.onCandleStick(event)
            me.candleStickLogListener.onCandleStick(event)
        })

        eventEmitter.on('order', async (event) => me.createOrderListener.onCreateOrder(event))

        eventEmitter.on('tick', async () => {
            me.tickListener.onTick()
        })

        eventEmitter.on('watchdog', async () => {
            me.exchangeOrderWatchdogListener.onTick()
        })

        eventEmitter.on('signal_tick', async () => me.signalListener.onSignalTick())

        eventEmitter.on('tick_ordering', async () => {
            await me.pairStateExecution.onPairStateExecutionTick()
            await me.orderExecutor.adjustOpenOrdersPrice()
        })
    }
};