'use strict';

const Gdax = require('gdax');

let Candlestick = require('./../dict/candlestick')
let Ticker = require('./../dict/ticker')
let CandlestickEvent = require('./../event/candlestick_event')
let TickerEvent = require('./../event/ticker_event')

let moment = require('moment')

module.exports = class CoinbasePro {
    constructor(eventEmitter, logger) {
        this.eventEmitter = eventEmitter
        this.logger = logger
    }

    start(config, symbols) {
        let eventEmitter = this.eventEmitter
        let logger = this.logger

        const websocket = new Gdax.WebsocketClient(['BTC-USD', 'ETH-USD']);

        const publicClient = new Gdax.PublicClient();

        symbols.forEach(symbol => {
            symbol['periods'].forEach(interval => {
                // backfill
                let granularity
                switch (interval) {
                    case '1m':
                        granularity = 60
                        break
                    case '5m':
                        granularity = 300
                        break
                    case '15m':
                        granularity = 900
                        break
                    case '1h':
                        granularity = 3600
                        break
                    default:
                        throw 'Invalid period for gdax'
                }

                publicClient.getProductHistoricRates(symbol['symbol'], {granularity: granularity}).then(candles => {
                    let ourCandles = candles.map(candle => {
                        return new Candlestick(
                            candle[0],
                            candle[3],
                            candle[2],
                            candle[1],
                            candle[4],
                            candle[5]
                        )
                    })

                    eventEmitter.emit('candlestick', new CandlestickEvent('coinbase_pro', symbol['symbol'], interval, ourCandles));
                })
            })
        })


        /*
                let candles = {}
        let lastCandleMap = {}
        websocket.on('message', (msg) => {

            if (!msg.price)
                return;

            if (!msg.size)
                return;

            if (!msg.product_id)
                return;

            // Price and volume are sent as strings by the API
            msg.price = parseFloat(msg.price)
            msg.size = parseFloat(msg.size)

            let productId = msg.product_id
            let [base, quote] = productId.split('-')

            // Round the time to the nearest minute, Change as per your resolution
            let roundedTime = Math.floor(new Date(msg.time) / 60000.0) * 60

            // If the candles hashmap doesnt have this product id create an empty object for that id
            if (!candles[productId]) {
                candles[productId] = {}
            }


            // If the current product's candle at the latest rounded timestamp doesnt exist, create it
            if (!candles[productId][roundedTime]) {

                //Before creating a new candle, lets mark the old one as closed
                let lastCandle = lastCandleMap[productId]

                if (lastCandle) {
                    lastCandle.closed = true;
                    delete candles[productId][lastCandle.timestamp]
                }

                // Set Quote Volume to -1 as GDAX doesnt supply it
                candles[productId][roundedTime] = {
                    timestamp: roundedTime,
                    open: msg.price,
                    high: msg.price,
                    low: msg.price,
                    close: msg.price,
                    baseVolume: msg.size,
                    quoteVolume: -1,
                    closed: false
                }
            }

            // If this timestamp exists in our map for the product id, we need to update an existing candle
            else {
                let candle = candles[productId][roundedTime]
                candle.high = msg.price > candle.high ? msg.price : candle.high
                candle.low = msg.price < candle.low ? msg.price : candle.low
                candle.close = msg.price
                candle.baseVolume = parseFloat((candle.baseVolume + msg.size).toFixed(8))

                // Set the last candle as the one we just updated
                lastCandleMap[productId] = candle
            }
        })
        */

        websocket.on('error', err => {
            /* handle error */
        })

        websocket.on('close', () => {
            /* ... */
        })
    }

    getName() {
        return 'coinbase_pro'
    }
}
