'use strict';

let Candlestick = require('../../dict/candlestick');
let ta = require('../../utils/technical_analysis');
const moment = require('moment');
let strategies = require('../../strategy/collection');

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
        let me = this

        this.instances.symbols.forEach((symbol) => {
            let ticker = this.tickers.get(symbol.exchange, symbol.symbol);

            if (!ticker) {
                console.error('Ticker no found for + ' + symbol.exchange + symbol.symbol)
                return;
            }

            let sql = 'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? order by time DESC LIMIT 500'

            this.db.all(sql, [symbol.exchange, symbol.symbol, '15m'], (err, rows) => me.taTick(symbol, ticker, '15m', ['cci'], err, rows))
            this.db.all(sql, [symbol.exchange, symbol.symbol, '1h'], (err, rows) => me.taTick(symbol, ticker, '1h', ['cci', 'macd'], err, rows))
        })
    }

    async taTick(symbol, ticker, period, namedStrategies, err, rows) {
        if (err) {
            console.log(err);
            return;
        }

        let candles = rows.map((row) => {
            return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
        });

        const taResult = await ta.getIndicatorsLookbacks(candles.slice().reverse());

        namedStrategies.forEach(async (strategyName) => {
            let signal;

            if (strategyName === 'cci') {
                signal = await strategies.cci(ticker.ask, taResult.sma_200.slice(), taResult.ema_200.slice(), taResult.cci.slice())
            } else if(strategyName === 'macd') {
                signal = await strategies.macd(ticker.ask, taResult.sma_200.slice(), taResult.macd.slice())
            }

            if (signal && signal.signal) {
                let signalWindow = moment().subtract(30, 'minutes').toDate();

                if (this.notified[symbol.exchange + symbol.symbol + strategyName + period] && signalWindow <= this.notified[symbol.exchange + symbol.symbol + strategyName + period]) {
                    // console.log('blocked')
                } else {
                    this.notified[symbol.exchange + symbol.symbol + strategyName + period] = new Date()
                    this.notifier.send('[' + signal.signal + ' (' + strategyName + ' ' + period + ')' + '] ' + symbol.exchange + ':' + symbol.symbol + ' - ' + ticker.ask)

                    // log signal
                    this.signalLogger.signal(symbol.exchange, symbol.symbol, {'price': ticker.ask, 'period': period, 'strategy': strategyName}, signal.signal, strategyName)
                }
            }
        })
    }
};
