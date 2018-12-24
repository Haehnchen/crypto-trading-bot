'use strict';

let express = require('express')
let twig = require("twig")
let auth = require('basic-auth');
let cookieParser = require('cookie-parser')
let crypto = require('crypto');

module.exports = class Http {
    constructor(systemUtil, ta, signalHttp, backtest, exchangeManager, pairsHttp, logsHttp) {
        this.systemUtil = systemUtil
        this.ta = ta
        this.signalHttp = signalHttp
        this.backtest = backtest
        this.exchangeManager = exchangeManager
        this.pairsHttp = pairsHttp
        this.logsHttp = logsHttp
    }

    start() {
        let periods = ['15m', '1h'];

        twig.extendFilter('price_format', function(value) {
            if (parseFloat(value) < 1) {
                return Intl.NumberFormat('en-US', {useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 6}).format(value)
            }

            return Intl.NumberFormat('en-US', {useGrouping: false, minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value)
        });

        var assetVersion = crypto.createHash('md5').update(String(Math.floor(Date.now() / 1000))).digest('hex').substring(0, 8);
        twig.extendFunction('asset_version', function() {
            return assetVersion
        });

        const app = express();

        app.set('twig options', {
            allow_async: true,
            strict_variables: true
        });

        app.use(express.urlencoded())
        app.use(cookieParser())
        app.use(express.static(__dirname + '/../web/static'))

        let username = this.systemUtil.getConfig('webserver.username')
        let password = this.systemUtil.getConfig('webserver.password')

        if (username && password) {
            app.use((request, response, next) => {
                let user = auth(request)

                if (!user || (user.name !== username && user.pass !== password)) {
                    response.set('WWW-Authenticate', 'Basic realm="Please Login"');
                    return response.status(401).send();
                }

                return next()
            })
        }

        let ta = this.ta

        app.get('/', (req, res) => {
            ta.getTaForPeriods(periods).then((result) => {
                res.render('../templates/base.html.twig', result);
            })
        })

        app.get('/backtest', async (req, res) => {
            res.render('../templates/backtest.html.twig', {
                'strategies': this.backtest.getBacktestStrategies(),
                'pairs': this.backtest.getBacktestPairs(),
            })
        })

        app.post('/backtest/submit', async (req, res) => {
            let pair = req.body.pair.split('.')

            res.render('../templates/backtest_submit.html.twig', await this.backtest.getBacktestResult(
                parseInt(req.body['ticker_interval']),
                req.body.hours,
                req.body.strategy,
                pair[0],
                pair[1],
                req.body.options ? JSON.parse(req.body.options) : {}
            ))
        })

        app.get('/tradingview/:symbol', (req, res) => {
            res.render('../templates/tradingview.html.twig', {
                symbol: req.params.symbol,
            })
        })

        app.get('/signals', async (req, res) => {
            res.render('../templates/signals.html.twig', {
                signals: await this.signalHttp.getSignals(Math.floor(Date.now() / 1000) - (60 * 60 * 48)),
            })
        })

        app.get('/pairs', async (req, res) => {
            res.render('../templates/pairs.html.twig', {
                pairs: await this.pairsHttp.getTradePairs(),
            })
        })

        app.get('/logs', async (req, res) => {
            res.render('../templates/logs.html.twig', await this.logsHttp.getLogsPageVariables(req, res))
        })

        app.post('/pairs/:pair', async (req, res) => {
            let pair = req.params.pair.split('-')
            let body = req.body;

            await this.pairsHttp.triggerOrder(pair[0], pair[1], body.action)

            // simple sleep for async ui blocking for exchange communication
            setTimeout(() => {
                res.redirect('/pairs');
            }, 800)
        })

        let exchangeManager = this.exchangeManager
        app.get('/trades', async (req, res) => {
            let positions = []
            let orders = []

            let exchanges = exchangeManager.all();
            for (let key in exchanges) {
                let exchange = exchanges[key]

                let myPositions = await exchange.getPositions()
                myPositions.forEach(position => {
                    positions.push({
                        'exchange': exchange.getName(),
                        'position': position,
                    })
                })

                let myOrders = await exchange.getOrders()
                myOrders.forEach(order => {
                    orders.push({
                        'exchange': exchange.getName(),
                        'order': order,
                    })
                })
            }

            res.render('../templates/trades.html.twig', {
                'orders': orders,
                'positions': positions.sort((a,b) => a.position.createdAt.getTime() - b.position.createdAt.getTime()),
            })
        })

        let ip = this.systemUtil.getConfig('webserver.ip', '0.0.0.0')
        let port = this.systemUtil.getConfig('webserver.port', 8080)

        app.listen(port, ip)

        console.log('Webserver listening on: ' + ip + ':' + port)
    }
}