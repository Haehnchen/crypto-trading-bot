'use strict';

let Candlestick = require('../../dict/candlestick.js');
let OrderEvent = require('../../event/order_event');
let Order = require('../../dict/order');
let ta = require('../../utils/technical_analysis');
const moment = require('moment');
let strategy = require('../../strategy/collection');

module.exports = class TickListener {
    constructor(db, tickers, instances, notifier, signalLogger, eventEmitter) {
        this.db = db
        this.tickers = tickers
        this.instances = instances
        this.notifier = notifier
        this.signalLogger = signalLogger
        this.eventEmitter = eventEmitter

        this.notified = {}
    }

    onTick() {
        let notifier = this.notifier

        this.instances.symbols.forEach((symbol) => {
            let ticker = this.tickers.get(symbol.exchange, symbol.symbol);

            if (!ticker) {
                console.error('Ticker no found for + ' + symbol.exchange + symbol.symbol)
                return;
            }

            let sql = 'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? order by time DESC LIMIT 500';

            this.db.all(sql, [symbol.exchange, symbol.symbol, '15m'], (err, rows) => {
                if (err) {
                    console.log(err);
                    return;
                }

                let candles = rows.map((row) => {
                    return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
                });

                (async () => {
                    const taResult = await ta.getIndicatorsLookbacks(candles.slice().reverse());

                    const signal = await strategy.cci(taResult.ema_55.slice(), taResult.ema_200.slice(), taResult.cci.slice())

                    if (signal && signal.signal) {
                        let signalWindow = moment().subtract(30, 'minutes').toDate();

                        if (this.notified[symbol.exchange + symbol.symbol] && signalWindow <= this.notified[symbol.exchange + symbol.symbol]) {
                            // console.log('blocked')
                        } else {
                            this.notified[symbol.exchange + symbol.symbol] = new Date()
                            notifier.send('[' + signal.signal + '] ' + symbol.exchange + ':' + symbol.symbol + ' - ' + ticker.ask)

                            // log signal
                            this.signalLogger.signal(symbol.exchange, symbol.symbol, {'price': ticker.ask}, signal.signal, 'cci')
                        }
                    }


                    //console.log(Math.floor(new Date() / 1000) - candles[0].time)

                    console.log('----')
                    let reverse = taResult['ema_200'].reverse();
                    console.log('ema_55: ' + reverse[0])
                    console.log('ema_200: ' + taResult['ema_200'].reverse()[0])
                    console.log('rsi: ' + taResult['rsi'].reverse()[0])
                    console.log('cci: ' + taResult['cci'].reverse()[0])
                    console.log('ao: ' + taResult['ao'].reverse()[0])
                    console.log('bid: ' + ticker.bid)
                    console.log('ask: ' + ticker.ask)

                    let wantPrice = reverse[0]

                    let side = 'buy'
                    if(ticker.ask < wantPrice) {
                        side = 'sell'
                    }

                    let order = new Order(
                        Math.round(((new Date()).getTime()).toString() * Math.random()),
                        symbol.symbol,
                        side,
                        reverse[0],
                        0.002
                    );

                    let e = new OrderEvent(symbol.exchange, order)

                    this.notifier.send('Create order: ' + JSON.stringify(e))

                    this.eventEmitter.emit('order', e)
                })()
            });
        })
    }
};