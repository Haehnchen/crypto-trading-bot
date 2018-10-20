'use strict';

const BinanceClient = require('binance-api-node').default

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let CandlestickEvent = require('./../event/candlestick_event')
let TickerEvent = require('./../event/ticker_event')

let moment = require('moment')

module.exports = class Binance {
    constructor(eventEmitter, logger) {
        this.eventEmitter = eventEmitter
        this.logger = logger
    }

    start(config, symbols) {
        const client = BinanceClient()
        const eventEmitter = this.eventEmitter
        const logger = this.logger

        symbols.forEach(symbol => {
            symbol['periods'].forEach(interval => {
                // backfill
                client.candles({'symbol': symbol['symbol'], 'limit': 500, 'interval': interval}).then((candles) => {
                    let ourCandles = candles.map(candle => {
                        return new Candlestick(
                            Math.round(candle['openTime'] / 1000),
                            candle['open'],
                            candle['high'],
                            candle['low'],
                            candle['close'],
                            candle['volume'],
                        )
                    })

                    eventEmitter.emit('candlestick', new CandlestickEvent('binance', symbol['symbol'], interval, ourCandles));
                })


                // live candles
                client.ws.candles(symbol['symbol'], interval, candle => {
                    let ourCandle = new Candlestick(
                        Math.round(candle['startTime'] / 1000),
                        candle['open'],
                        candle['high'],
                        candle['low'],
                        candle['close'],
                        candle['volume'],
                    )

                    eventEmitter.emit('candlestick', new CandlestickEvent('binance', symbol['symbol'], interval, [ourCandle]));
                })

                // live prices
                client.ws.ticker(symbol['symbol'], ticker => {
                    eventEmitter.emit('ticker', new TickerEvent(
                        'binance',
                        symbol['symbol'],
                        new Ticker('binance', symbol['symbol'], moment().format('X'), ticker['bestBid'], ticker['bestAsk'])
                    ))
                })
            })
        })
    }

    getOrders() {
        return []
    }

    getOrdersForSymbol(symbol) {
        return []
    }

    getPositions() {
        return []
    }

    getPositionForSymbol(symbol) {
        return undefined
    }

    getName() {
        return 'binance'
    }
}
