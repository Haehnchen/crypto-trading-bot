'use strict';

const moment = require('moment')
const StrategyContext = require('../../dict/strategy_context')
let _ = require('lodash')

module.exports = class TickListener {
    constructor(tickers, instances, notifier, signalLogger, strategyManager, exchangeManager, pairStateManager, logger) {
        this.tickers = tickers
        this.instances = instances
        this.notifier = notifier
        this.signalLogger = signalLogger
        this.strategyManager = strategyManager
        this.exchangeManager = exchangeManager
        this.pairStateManager = pairStateManager
        this.logger = logger

        this.notified = {}
    }

    async visitStrategy(strategy, symbol) {
        let ticker = this.tickers.get(symbol.exchange, symbol.symbol)

        if (!ticker) {
            console.error('Ticker no found for + ' + symbol.exchange + symbol.symbol)
            return
        }

        let strategyKey = strategy.strategy

        let context = StrategyContext.create(ticker)
        let position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol)
        if (position) {
            context = StrategyContext.createFromPosition(ticker, position)
        }

        let result = await this.strategyManager.executeStrategy(strategyKey, context, symbol.exchange, symbol.symbol, strategy['options'] || {})
        if (!result) {
            return
        }

        let signal = result.getSignal()
        if (!signal || typeof signal === 'undefined') {
            return
        }

        if (!['close', 'short', 'long'].includes(signal)) {
            throw 'Invalid signal: ' + signal
        }

        let signalWindow = moment().subtract(30, 'minutes').toDate();

        if (this.notified[symbol.exchange + symbol.symbol + strategyKey] && signalWindow <= this.notified[symbol.exchange + symbol.symbol + strategyKey]) {
            // console.log('blocked')
        } else {
            this.notified[symbol.exchange + symbol.symbol + strategyKey] = new Date()
            this.notifier.send('[' + signal + ' (' + strategyKey + ')' + '] ' + symbol.exchange + ':' + symbol.symbol + ' - ' + ticker.ask)

            // log signal
            this.signalLogger.signal(symbol.exchange, symbol.symbol, {'price': ticker.ask, 'strategy': strategyKey, 'raw': JSON.stringify(result)}, signal, strategyKey)
        }
    }

    async visitTradeStrategy(strategy, symbol) {
        let ticker = this.tickers.get(symbol.exchange, symbol.symbol)

        if (!ticker) {
            console.error('Ticker no found for + ' + symbol.exchange + symbol.symbol)
            return
        }

        let strategyKey = strategy.strategy

        let context = StrategyContext.create(ticker)
        let position = await this.exchangeManager.getPosition(symbol.exchange, symbol.symbol)
        if (position) {
            context = StrategyContext.createFromPosition(ticker, position)
        }

        let result = await this.strategyManager.executeStrategy(strategyKey, context, symbol.exchange, symbol.symbol, strategy['options'] || {})
        if (!result) {
            return
        }

        let signal = result.getSignal()
        if (!signal || typeof signal === 'undefined') {
            return
        }
        
        if (!['close', 'short', 'long'].includes(signal)) {
            throw 'Invalid signal: ' + signal
        }

        let signalWindow = moment().subtract(_.get(symbol, 'trade.signal_slowdown_minutes', 15), 'minutes').toDate();

        let noteKey = symbol.exchange + symbol.symbol
        if (noteKey in this.notified && this.notified[noteKey] >= signalWindow) {
            return
        }

        // log signal
        this.logger.info([new Date().toISOString(), signal, strategyKey, symbol.exchange, symbol.symbol, ticker.ask].join(' '))
        this.notifier.send('[' + signal + ' (' + strategyKey + ')' + '] ' + symbol.exchange + ':' + symbol.symbol + ' - ' + ticker.ask)
        this.signalLogger.signal(symbol.exchange, symbol.symbol, {'price': ticker.ask, 'strategy': strategyKey, 'raw': JSON.stringify(result)}, signal, strategyKey)
        this.notified[noteKey] = new Date()

        await this.pairStateManager.update(symbol.exchange, symbol.symbol, signal)
    }

    onTick() {
        this.instances.symbols.filter(symbol => symbol.trade && symbol.trade.strategies && symbol.trade.strategies.length > 0).forEach(async symbol => {
            symbol.trade.strategies.forEach(async (strategy) => {
                await this.visitTradeStrategy(strategy, symbol)
            })
        })

        this.instances.symbols.filter((symbol) => symbol.strategies && symbol.strategies.length > 0).forEach(async symbol => {
            symbol.strategies.forEach(async (strategy) => {
                await this.visitStrategy(strategy, symbol)
            })
        })
    }
}
