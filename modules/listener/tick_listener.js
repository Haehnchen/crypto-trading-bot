'use strict';

let Candlestick = require('../../dict/candlestick.js');
let ta = require('../../utils/technical_analysis');

module.exports = class TickListener {
    constructor(db, tickers, instances) {
        this.db = db
        this.tickers = tickers
        this.instances = instances
    }

    onTick() {
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
                    const result = await ta.getIndicatorsLookbacks(candles.reverse());

                    /*
                    console.log('----')
                    let reverse = result['ema_55'].reverse();
                    console.log('ema_55: ' + reverse[0])
                    console.log('ema_200: ' + result['ema_200'].reverse()[0])
                    console.log('rsi: ' + result['rsi'].reverse()[0])
                    console.log('cci: ' + result['cci'].reverse()[0])
                    console.log('ao: ' + result['ao'].reverse()[0])
                    console.log('bid: ' + ticker.bid)
                    console.log('ask: ' + ticker.ask)


                    let wantPrice = reverse[0]

                    let side = 'buy'
                    if(ticker.ask < wantPrice) {
                        side = 'sell'
                    }
                    */

                    /*
                    let e = new OrderEvent(
                        symbol.exchange,
                        symbol.symbol,
                        new Order(side, reverse[0], 10)
                    )

                    notify.send('Create order: ' + JSON.stringify(e))


                    eventEmitter.emit('order', new OrderEvent(
                        symbol.exchange,
                        symbol.symbol,
                        new Order(side, reverse[0], 10)
                    ))
                    */

                })()
            });
        })
    }
};