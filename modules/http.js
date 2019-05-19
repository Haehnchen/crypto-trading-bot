'use strict';

let express = require('express');
let twig = require("twig");
let auth = require('basic-auth');
let cookieParser = require('cookie-parser');
let crypto = require('crypto');
let moment = require('moment');

module.exports = class Http {
    constructor(systemUtil, ta, signalHttp, backtest, exchangeManager, pairsHttp, logsHttp, candleExportHttp, candleImporter) {
        this.systemUtil = systemUtil;
        this.ta = ta;
        this.signalHttp = signalHttp;
        this.backtest = backtest;
        this.exchangeManager = exchangeManager;
        this.pairsHttp = pairsHttp;
        this.logsHttp = logsHttp;
        this.candleExportHttp = candleExportHttp
        this.candleImporter = candleImporter
    }

    start() {
        twig.extendFilter('price_format', function (value) {
            if (parseFloat(value) < 1) {
                return Intl.NumberFormat('en-US', {
                    useGrouping: false,
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6
                }).format(value)
            }

            return Intl.NumberFormat('en-US', {
                useGrouping: false,
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value)
        });

        var assetVersion = crypto.createHash('md5').update(String(Math.floor(Date.now() / 1000))).digest('hex').substring(0, 8);
        twig.extendFunction('asset_version', function () {
            return assetVersion
        });

        twig.extendFilter('format_json', function (value) {
            return JSON.stringify(value, null, '\t')
        });

        const app = express();

        app.set('twig options', {
            allow_async: true,
            strict_variables: true
        });

        app.use(express.urlencoded({limit: "12mb", extended: true, parameterLimit:50000}));
        app.use(cookieParser());
        app.use(express.static(__dirname + '/../web/static'));

        let username = this.systemUtil.getConfig('webserver.username');
        let password = this.systemUtil.getConfig('webserver.password');

        if (username && password) {
            app.use((request, response, next) => {
                let user = auth(request);

                if (!user || !(user.name === username && user.pass === password)) {
                    response.set('WWW-Authenticate', 'Basic realm="Please Login"');
                    return response.status(401).send();
                }

                return next()
            })
        }

        let ta = this.ta;

        app.get('/', async (req, res) => {
            res.render('../templates/base.html.twig', await ta.getTaForPeriods(['15m', '1h']));
        });

        app.get('/backtest', async (req, res) => {
            res.render('../templates/backtest.html.twig', {
                'strategies': this.backtest.getBacktestStrategies(),
                'pairs': this.backtest.getBacktestPairs(),
            })
        });

        app.post('/backtest/submit', async (req, res) => {
            let pair = req.body.pair.split('.');

            res.render('../templates/backtest_submit.html.twig', await this.backtest.getBacktestResult(
                parseInt(req.body['ticker_interval']),
                req.body.hours,
                req.body.strategy,
                req.body.candle_period,
                pair[0],
                pair[1],
                req.body.options ? JSON.parse(req.body.options) : {}
            ))
        });

        app.get('/tradingview/:symbol', (req, res) => {
            res.render('../templates/tradingview.html.twig', {
                symbol: req.params.symbol.replace('-', '').replace('coinbase_pro', 'coinbase'),
            })
        });

        app.get('/signals', async (req, res) => {
            res.render('../templates/signals.html.twig', {
                signals: await this.signalHttp.getSignals(Math.floor(Date.now() / 1000) - (60 * 60 * 48)),
            })
        });

        app.get('/pairs', async (req, res) => {
            res.render('../templates/pairs.html.twig', {
                pairs: await this.pairsHttp.getTradePairs(),
            })
        });

        app.get('/logs', async (req, res) => {
            res.render('../templates/logs.html.twig', await this.logsHttp.getLogsPageVariables(req, res))
        });

        app.get('/tools/candles', async (req, res) => {
            let options = {
                'pairs': await this.candleExportHttp.getPairs(),
                'start': moment().subtract(7, 'days').toDate(),
                'end': new Date(),
            };

            if (req.query.pair && req.query.period && req.query.period && req.query.start && req.query.end) {
                let [exchange, symbol] = req.query.pair.split('.');
                let candles = await this.candleExportHttp.getCandles(
                    exchange,
                    symbol,
                    req.query.period,
                    new Date(req.query.start),
                    new Date(req.query.end),
                );

                if (req.query.metadata) {
                    candles.map(c => {
                        c['exchange'] = exchange
                        c['symbol'] = symbol
                        c['period'] = req.query.period
                        return c
                    })
                }

                options.start = new Date(req.query.start);
                options.end = new Date(req.query.end);

                options.exchange = exchange;
                options.symbol = symbol;
                options.period = req.query.period;
                options.candles = candles;
                options.candles_json = JSON.stringify(candles, null, 2)
            }

            res.render('../templates/candle_stick_export.html.twig', options)
        });

        app.post('/tools/candles', async (req, res) => {
            let exchangeCandlesticks = JSON.parse(req.body.json);
            await this.candleImporter.insertCandles(exchangeCandlesticks)

            console.log('Imported: ' + exchangeCandlesticks.length + ' items')

            res.redirect('/tools/candles');
        });

        app.post('/pairs/:pair', async (req, res) => {
            let pair = req.params.pair.split('-');
            let body = req.body;

            // exchange-ETC-FOO
            // exchange-ETCFOO
            let symbol = req.params.pair.substring(pair[0].length + 1);

            await this.pairsHttp.triggerOrder(pair[0], symbol, body.action);

            // simple sleep for async ui blocking for exchange communication
            setTimeout(() => {
                res.redirect('/pairs');
            }, 800)
        });

        let exchangeManager = this.exchangeManager;
        app.get('/order/:exchange/:id', async (req, res) => {
            let exchangeName = req.params.exchange;
            let id = req.params.id;

            let exchange = exchangeManager.get(exchangeName);

            try {
                await exchange.cancelOrder(id)
            } catch (e) {
                console.log('Cancel order error: ' + JSON.stringify([exchangeName, id]))
            }

            res.redirect('/trades')
        });

        app.get('/trades', async (req, res) => {
            let positions = [];
            let orders = [];

            let exchanges = exchangeManager.all();
            for (let key in exchanges) {
                let exchange = exchanges[key];

                let exchangeName = exchange.getName();

                let myPositions = await exchange.getPositions();
                myPositions.forEach(position => {
                    // simply converting of asset to currency value
                    let currencyValue;
                    if (exchangeName.includes('bitmex') && ['XBTUSD', 'ETHUSD'].includes(position.symbol)) {
                        currencyValue = Math.abs(position.amount)
                    } else if (position.amount && position.entry) {
                        currencyValue = position.entry * Math.abs(position.amount)
                    }

                    positions.push({
                        'exchange': exchangeName,
                        'position': position,
                        'currency': currencyValue
                    })
                });

                let myOrders = await exchange.getOrders();
                myOrders.forEach(order => {
                    orders.push({
                        'exchange': exchange.getName(),
                        'order': order,
                    })
                })
            }

            res.render('../templates/trades.html.twig', {
                'orders': orders,
                'positions': positions.sort((a, b) => a.position.createdAt.getTime() - b.position.createdAt.getTime()),
            })
        });

        let ip = this.systemUtil.getConfig('webserver.ip', '0.0.0.0');
        let port = this.systemUtil.getConfig('webserver.port', 8080);

        app.listen(port, ip);

        console.log('Webserver listening on: ' + ip + ':' + port)
    }
};
