'use strict';

const BFX = require('bitfinex-api-node')

let Candlestick = require('./../dict/candlestick.js');
let Ticker = require('./../dict/ticker.js');
let Orderbook = require('./../dict/orderbook.js');

let CandlestickEvent = require('./../event/candlestick_event.js');
let TickerEvent = require('./../event/ticker_event.js');
let OrderbookEvent = require('./../event/orderbook_event.js');

let moment = require('moment')
const request = require('request');

module.exports = class Bitfinex {
    constructor(eventEmitter, config, instances) {
        var bfx = new BFX(config['key'], config['secret'], {version: 2, transform: true, autoOpen: true});
        var ws = this.client = bfx.ws

        ws.on('error', function(err) {
            console.log('error')
            console.log(err)
        })

        ws.on('open', function() {
            instances.forEach(function (instance) {

                // candles
                instance.periods.forEach(function (period) {
                    console.log('Bitfinex: symbol: ' + instance['symbol'] + ' p: ' + period);

                    if(period === '1d') {
                        period = period.toUpperCase();
                    }

                    ws.subscribeCandles('t' + instance['symbol'], period);
                })

                // ticket

                ws.subscribeTicker('t' + instance['symbol']);
                //ws.subscribeOrderBook('t' + instance['symbol']);
            })

            // authenticate
            ws.auth()
        })

        ws.on('ticker', function(pair, ticker) {
            let myPair = pair;

            if (myPair.substring(0, 1) === 't') {
                myPair = myPair.substring(1)
            }

            eventEmitter.emit('ticker', new TickerEvent(
                'bitfinex',
                myPair,
                new Ticker(moment().format('X'), ticker['BID'], ticker['ASK'])
            ));
        })

        ws.on('cs', function() {
        })

        ws.on('candles', function(pair, candles) {
            let options = pair.split(':');

            let period = options[1].toLowerCase();
            let mySymbol = options[2];

            if (mySymbol.substring(0, 1) === 't') {
                mySymbol = mySymbol.substring(1)
            }

            let myCandles = [];

            if(Array.isArray(candles)) {
                candles.forEach(function(candle) {
                    myCandles.push(candle)
                })
            } else {
                myCandles.push(candles)
            }

            let sticks = myCandles.filter(function (candle) {
                return typeof candle['MTS'] !== 'undefined';
            }).map(function(candle) {
                return new Candlestick(
                    Math.round(candle['MTS'] / 1000),
                    candle['OPEN'],
                    candle['HIGH'],
                    candle['LOW'],
                    candle['CLOSE'],
                    candle['VOLUME'],
                );
            });

            if(sticks.length === 0) {
                console.error('Candle issue: ' + pair)
                return;
            }

            eventEmitter.emit('candlestick', new CandlestickEvent('bitfinex', mySymbol, period.toLowerCase(), sticks));
        })

        ws.on('on', function() {
            console.log(arguments)
        })

        ws.on('on-req', function() {
            console.log(arguments)
        })

        ws.on('ou', function() {
            console.log(arguments)
        })

        ws.on('oc', function() {
            console.log(arguments)
        })
    }

    order() {
        var cid = Math.round(((new Date()).getTime()).toString() * Math.random())

        var ws_order = [
            0,
            'on',
            null,
            {
                cid: cid,
                type: 'LIMIT',
                symbol: 'tNEOUSD',
                amount: String(1),
                price: String(36.154),
                hidden: 0,
                postonly: 1
            }
        ]

        console.log(ws_order)

        this.client.submitOrder(ws_order);
    }
}

