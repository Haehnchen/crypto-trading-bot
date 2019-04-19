let Candlestick = require('./../dict/candlestick.js');
let ta = require('../utils/technical_analysis');
let Ticker = require('../dict/ticker');
let moment = require('moment');

module.exports = class Ta {
    constructor(db, instances) {
        this.instances = instances
        this.db = db
    }

    getTaForPeriods (periods) {
        return new Promise((resolve) => {
            let db = this.db

            let promises = [];

            this.instances['symbols'].forEach((symbol) => {
                periods.forEach(period => {
                    promises.push(new Promise((resolve) => {
                        let sql = 'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? order by time DESC LIMIT 200';

                        db.all(sql, [symbol.exchange, symbol.symbol, period], (err, rows) => {
                            if (err) {
                                console.log(err);
                                resolve();
                                return;
                            }

                            let candles = rows.map((row) => {
                                return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume)
                            });

                            if (candles.length === 0) {
                                resolve();
                                return;
                            }

                            let range = moment().subtract(24, 'hours')

                            let rangeMin = moment().subtract(24, 'hours').subtract(35, 'minutes').unix()
                            let rangeMax = moment().subtract(24, 'hours').add(35, 'minutes').unix()


                            let dayCandle = candles.find(candle =>
                                candle.time > rangeMin && candle.time < rangeMax
                            )

                            let change
                            if (dayCandle) {
                                change = 100 * (candles[0].close / dayCandle.close) - 100
                            }

                            ta.getIndicatorsLookbacks(candles.slice().reverse()).then(result => {
                                resolve({
                                    'symbol': symbol.symbol,
                                    'exchange': symbol.exchange,
                                    'period': period,
                                    'ta': result,
                                    'ticker': new Ticker(symbol.exchange, symbol.symbol, undefined, candles[0].close, candles[0].close),
                                    'percentage_change': change,
                                })
                            })
                        });
                    }))
                })
            })

            Promise.all(promises).then(values => {
                let v = values.filter((value) => {
                    return value !== undefined
                });

                let x = {}

                v.forEach((v) => {
                    if (!x[v.symbol]) {
                        x[v.symbol] = {
                            'symbol': v.symbol,
                            'exchange': v.exchange,
                            'ticker': v.ticker,
                            'ta': {},
                            'percentage_change': v.percentage_change,
                        }
                    }

                    // flat indicator list
                    let values = {}

                    for (let key in v.ta) {
                        let taResult = v.ta[key];

                        values[key] = {
                            'value': taResult[taResult.length - 1],
                        }

                        if (key == 'macd') {
                            let r = taResult.slice()

                            values[key]['trend'] = ta.getTrendingDirectionLastItem(r.slice(-2).map((v) => v.histogram))

                            let number = ta.getCrossedSince(r.map((v) => v.histogram))

                            if (number) {
                                let multiplicator = 1
                                if (v.period == '1h') {
                                    multiplicator = 60
                                } else if (v.period == '15m') {
                                    multiplicator = 15
                                }

                                values[key]['crossed'] = number * multiplicator
                                values[key]['crossed_index'] = number
                            }
                        } else if (key == 'ao') {
                            let r = taResult.slice()

                            values[key]['trend'] = ta.getTrendingDirectionLastItem(r.slice(-2))

                            let number = ta.getCrossedSince(r)

                            if (number) {
                                let multiplicator = 1
                                if (v.period == '1h') {
                                    multiplicator = 60
                                } else if (v.period == '15m') {
                                    multiplicator = 15
                                }

                                values[key]['crossed'] = number * multiplicator
                                values[key]['crossed_index'] = number
                            }
                        } else if (key == 'bollinger_bands') {
                            values[key]['percent'] = values[key].value && values[key].value.upper && values[key].value.lower
                                ? ta.getBollingerBandPercent((v.ticker.ask + v.ticker.bid) / 2, values[key].value.upper, values[key].value.lower) * 100
                                : null

                        } else if (key == 'ema_200' || key == 'ema_55' || key == 'cci' || key == 'rsi' || key == 'ao' || key == 'mfi') {
                            values[key]['trend'] = ta.getTrendingDirection(taResult.slice().reverse().slice(-5))
                        }
                    }

                    x[v.symbol]['ta'][v.period] = values
                })

                resolve({
                    rows: x,
                    periods: periods,
                })
            });
        })
    }
}
