const compression = require('compression');
const express = require('express');
const twig = require('twig');
const auth = require('basic-auth');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const moment = require('moment');

module.exports = class Http {
  constructor(
    systemUtil,
    ta,
    signalHttp,
    backtest,
    exchangeManager,
    pairsHttp,
    logsHttp,
    candleExportHttp,
    candleImporter,
    ordersHttp
  ) {
    this.systemUtil = systemUtil;
    this.ta = ta;
    this.signalHttp = signalHttp;
    this.backtest = backtest;
    this.exchangeManager = exchangeManager;
    this.pairsHttp = pairsHttp;
    this.logsHttp = logsHttp;
    this.candleExportHttp = candleExportHttp;
    this.candleImporter = candleImporter;
    this.ordersHttp = ordersHttp;
  }

  start() {
    twig.extendFilter('price_format', function(value) {
      if (parseFloat(value) < 1) {
        return Intl.NumberFormat('en-US', {
          useGrouping: false,
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        }).format(value);
      }

      return Intl.NumberFormat('en-US', {
        useGrouping: false,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(value);
    });

    const assetVersion = crypto
      .createHash('md5')
      .update(String(Math.floor(Date.now() / 1000)))
      .digest('hex')
      .substring(0, 8);
    twig.extendFunction('asset_version', function() {
      return assetVersion;
    });

    const desks = this.systemUtil.getConfig('desks', []).map(desk => desk.name);
    twig.extendFunction('desks', function() {
      return desks;
    });

    twig.extendFilter('format_json', function(value) {
      return JSON.stringify(value, null, '\t');
    });

    const app = express();

    app.set('twig options', {
      allow_async: true,
      strict_variables: true
    });

    app.use(express.urlencoded({ limit: '12mb', extended: true, parameterLimit: 50000 }));
    app.use(cookieParser());
    app.use(compression());
    app.use(express.static(`${__dirname}/../web/static`));

    const username = this.systemUtil.getConfig('webserver.username');
    const password = this.systemUtil.getConfig('webserver.password');

    if (username && password) {
      app.use((request, response, next) => {
        const user = auth(request);

        if (!user || !(user.name === username && user.pass === password)) {
          response.set('WWW-Authenticate', 'Basic realm="Please Login"');
          return response.status(401).send();
        }

        return next();
      });
    }

    const { ta } = this;

    app.get('/', async (req, res) => {
      res.render('../templates/base.html.twig', await ta.getTaForPeriods(['15m', '1h']));
    });

    app.get('/backtest', async (req, res) => {
      res.render('../templates/backtest.html.twig', {
        strategies: this.backtest.getBacktestStrategies(),
        pairs: this.backtest.getBacktestPairs()
      });
    });

    app.post('/backtest/submit', async (req, res) => {
      const pair = req.body.pair.split('.');

      res.render(
        '../templates/backtest_submit.html.twig',
        await this.backtest.getBacktestResult(
          parseInt(req.body.ticker_interval),
          req.body.hours,
          req.body.strategy,
          req.body.candle_period,
          pair[0],
          pair[1],
          req.body.options ? JSON.parse(req.body.options) : {}
        )
      );
    });

    app.get('/tradingview/:symbol', (req, res) => {
      res.render('../templates/tradingview.html.twig', {
        symbol: req.params.symbol
          .replace('-', '')
          .replace('coinbase_pro', 'coinbase')
          .toUpperCase()
      });
    });

    app.get('/signals', async (req, res) => {
      res.render('../templates/signals.html.twig', {
        signals: await this.signalHttp.getSignals(Math.floor(Date.now() / 1000) - 60 * 60 * 48)
      });
    });

    app.get('/pairs', async (req, res) => {
      res.render('../templates/pairs.html.twig', {
        pairs: await this.pairsHttp.getTradePairs()
      });
    });

    app.get('/logs', async (req, res) => {
      res.render('../templates/logs.html.twig', await this.logsHttp.getLogsPageVariables(req, res));
    });

    app.get('/desks/:desk', async (req, res) => {
      res.render('../templates/desks.html.twig', {
        desk: this.systemUtil.getConfig('desks')[req.params.desk],
        interval: req.query.interval || undefined,
        id: req.params.desk
      });
    });

    app.get('/tools/candles', async (req, res) => {
      const options = {
        pairs: await this.candleExportHttp.getPairs(),
        start: moment()
          .subtract(7, 'days')
          .toDate(),
        end: new Date()
      };

      if (req.query.pair && req.query.period && req.query.period && req.query.start && req.query.end) {
        const [exchange, symbol] = req.query.pair.split('.');
        const candles = await this.candleExportHttp.getCandles(
          exchange,
          symbol,
          req.query.period,
          new Date(req.query.start),
          new Date(req.query.end)
        );

        if (req.query.metadata) {
          candles.map(c => {
            c.exchange = exchange;
            c.symbol = symbol;
            c.period = req.query.period;
            return c;
          });
        }

        options.start = new Date(req.query.start);
        options.end = new Date(req.query.end);

        options.exchange = exchange;
        options.symbol = symbol;
        options.period = req.query.period;
        options.candles = candles;
        options.candles_json = JSON.stringify(candles, null, 2);
      }

      res.render('../templates/candle_stick_export.html.twig', options);
    });

    app.post('/tools/candles', async (req, res) => {
      const exchangeCandlesticks = JSON.parse(req.body.json);
      await this.candleImporter.insertCandles(exchangeCandlesticks);

      console.log(`Imported: ${exchangeCandlesticks.length} items`);

      res.redirect('/tools/candles');
    });

    app.post('/pairs/:pair', async (req, res) => {
      const pair = req.params.pair.split('-');
      const { body } = req;

      // exchange-ETC-FOO
      // exchange-ETCFOO
      const symbol = req.params.pair.substring(pair[0].length + 1);

      await this.pairsHttp.triggerOrder(pair[0], symbol, body.action);

      // simple sleep for async ui blocking for exchange communication
      setTimeout(() => {
        res.redirect('/pairs');
      }, 800);
    });

    const { exchangeManager } = this;
    app.get('/order/:exchange/:id', async (req, res) => {
      const exchangeName = req.params.exchange;
      const { id } = req.params;

      const exchange = exchangeManager.get(exchangeName);

      try {
        await exchange.cancelOrder(id);
      } catch (e) {
        console.log(`Cancel order error: ${JSON.stringify([exchangeName, id, String(e)])}`);
      }

      res.redirect('/trades');
    });

    app.get('/orders', async (req, res) => {
      res.render('../templates/orders/index.html.twig', {
        pairs: this.ordersHttp.getPairs()
      });
    });

    app.get('/orders/:pair', async (req, res) => {
      const { pair } = req.params;
      const tradingview = pair.split('.');

      const ticker = this.ordersHttp.getTicker(pair);

      res.render('../templates/orders/orders.html.twig', {
        pair: pair,
        pairs: this.ordersHttp.getPairs(),
        orders: this.ordersHttp.getOrders(pair),
        position: await this.exchangeManager.getPosition(tradingview[0], tradingview[1]),
        ticker: ticker,
        tradingview: `${tradingview[0]}:${tradingview[1]}`
          .replace('-', '')
          .replace('coinbase_pro', 'coinbase')
          .toUpperCase(),
        form: {
          price: ticker ? ticker.bid : undefined,
          type: 'limit'
        }
      });
    });

    app.post('/orders/:pair', async (req, res) => {
      const { pair } = req.params;
      const tradingview = pair.split('.');

      const ticker = this.ordersHttp.getTicker(pair);
      const form = req.body;

      let success = true;
      let message;
      let result;

      try {
        result = await this.ordersHttp.createOrder(pair, form);
        message = JSON.stringify(result);

        if (!result || result.shouldCancelOrderProcess()) {
          success = false;
        }
      } catch (e) {
        success = false;
        message = String(e);
      }

      res.render('../templates/orders/orders.html.twig', {
        pair: pair,
        pairs: this.ordersHttp.getPairs(),
        orders: this.ordersHttp.getOrders(pair),
        ticker: ticker,
        position: await this.exchangeManager.getPosition(tradingview[0], tradingview[1]),
        form: form,
        tradingview: `${tradingview[0]}:${tradingview[1]}`
          .replace('-', '')
          .replace('coinbase_pro', 'coinbase')
          .toUpperCase(),
        alert: {
          title: success ? 'Order Placed' : 'Place Error',
          type: success ? 'success' : 'danger',
          message: message
        }
      });
    });

    app.get('/orders/:pair/cancel/:id', async (req, res) => {
      const foo = await this.ordersHttp.cancel(req.params.pair, req.params.id);
      res.redirect(`/orders/${req.params.pair}`);
    });

    app.get('/orders/:pair/cancel-all', async (req, res) => {
      await this.ordersHttp.cancelAll(req.params.pair);
      res.redirect(`/orders/${req.params.pair}`);
    });

    app.get('/trades', async (req, res) => {
      const positions = [];
      const orders = [];

      const exchanges = exchangeManager.all();
      for (const key in exchanges) {
        const exchange = exchanges[key];

        const exchangeName = exchange.getName();

        const myPositions = await exchange.getPositions();
        myPositions.forEach(position => {
          // simply converting of asset to currency value
          let currencyValue;
          if (
            (exchangeName.includes('bitmex') && ['XBTUSD', 'ETHUSD'].includes(position.symbol)) ||
            exchangeName.includes('bybit')
          ) {
            // inverse exchanges
            currencyValue = Math.abs(position.amount);
          } else if (position.amount && position.entry) {
            currencyValue = position.entry * Math.abs(position.amount);
          }

          positions.push({
            exchange: exchangeName,
            position: position,
            currency: currencyValue
          });
        });

        const myOrders = await exchange.getOrders();
        myOrders.forEach(order => {
          orders.push({
            exchange: exchange.getName(),
            order: order
          });
        });
      }

      res.render('../templates/trades.html.twig', {
        orders: orders,
        positions: positions.sort(
          (a, b) =>
            (!a.position.createdAt ? 0 : a.position.createdAt.getTime()) -
            (!b.position.createdAt ? 0 : b.position.createdAt.getTime())
        )
      });
    });

    const ip = this.systemUtil.getConfig('webserver.ip', '0.0.0.0');
    const port = this.systemUtil.getConfig('webserver.port', 8080);

    app.listen(port, ip);

    console.log(`Webserver listening on: ${ip}:${port}`);
  }
};
