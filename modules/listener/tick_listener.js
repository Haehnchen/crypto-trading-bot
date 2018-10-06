'use strict';

let Candlestick = require('../../dict/candlestick');
const moment = require('moment');

module.exports = class TickListener {
    constructor(tickers, instances, notifier, signalLogger, strategyManager) {
        this.tickers = tickers
        this.instances = instances
        this.notifier = notifier
        this.signalLogger = signalLogger
        this.strategyManager = strategyManager

        this.notified = {}
    }

    onTick() {
        this.instances.symbols.forEach((symbol) => {
            let ticker = this.tickers.get(symbol.exchange, symbol.symbol)

            if (!ticker) {
                console.error('Ticker no found for + ' + symbol.exchange + symbol.symbol)
                return;
            }

            if (!symbol.strategies) {
                return;
            }

            symbol.strategies.forEach(async (strategy) => {
                let strategyName = strategy.name;

                let signal = await this.strategyManager.executeStrategy(strategyName, ticker.ask, symbol.exchange, symbol.symbol, strategy['options'] || {})

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
        })
    }
};
