const compression = require('compression');
const express = require('express');
const twig = require('twig');
const auth = require('basic-auth');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const moment = require('moment');
const Path = require('path');

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
    ordersHttp,
    projectDir
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
    this.projectDir = projectDir;
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

    app.set('views', `${this.projectDir}/templates`);
    app.set('twig options', {
      allow_async: true,
      strict_variables: false
    });

    app.use(express.urlencoded({ limit: '12mb', extended: true, parameterLimit: 50000 }));
    app.use(cookieParser());
    app.use(compression());
    app.use(express.static(`${this.projectDir}/web/static`, { maxAge: 3600000 * 24 }));
    app.use('/scripts/jquery', express.static(Path.join(this.projectDir, 'node_modules/jquery/dist')));
    app.use('/scripts/moment', express.static(Path.join(this.projectDir, '/node_modules/moment/min')));
    app.use('/scripts/datatables.net', express.static(Path.join(this.projectDir, '/node_modules/datatables.net/js')));
    app.use('/scripts/bootstrap', express.static(Path.join(this.projectDir, '/node_modules/bootstrap/dist/js')));
    app.use('/css/bootstrap', express.static(Path.join(this.projectDir, '/node_modules/bootstrap/dist/css')));
    app.use(
      '/scripts/datatables.net-bs4/',
      express.static(Path.join(this.projectDir, '/node_modules/datatables.net-bs4/js'))
    );
    app.use(
      '/css/datatables.net-bs4/',
      express.static(Path.join(this.projectDir, '/node_modules/datatables.net-bs4/css'))
    );
    app.use(
      '/scripts/datatables.net-plugins/',
      express.static(Path.join(this.projectDir, '/node_modules/datatables.net-plugins'))
    );
    app.use(
      '/scripts/datatables.net-responsive/',
      express.static(Path.join(this.projectDir, '/node_modules/datatables.net-responsive/js'))
    );
    app.use(
      '/scripts/datatables.net-responsive-bs4/',
      express.static(Path.join(this.projectDir, '/node_modules/datatables.net-responsive-bs4/js'))
    );
    app.use(
      '/css/datatables.net-responsive-bs4/',
      express.static(Path.join(this.projectDir, '/node_modules/datatables.net-responsive-bs4/css'))
    );

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
      res.render(
        '../templates/base.html.twig',
        await ta.getTaForPeriods(this.systemUtil.getConfig('dashboard.periods', ['15m', '1h']))
      );
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
        symbol: this.buildTradingViewSymbol(req.params.symbol)
      });
    });

    app.get('/signals', async (req, res) => {
      res.render('../templates/signals.html.twig', {
        signals: await this.signalHttp.getSignals(Math.floor(Date.now() / 1000) - 60 * 60 * 48)
      });
    });

    app.get('/pairs', async (req, res) => {
      res.render('../templates/pairs.html.twig', {});
    });

    app.get('/pairs/trade', async (req, res) => {
      const pairs = await this.pairsHttp.getTradePairs();
      res.json({
        draw: req.body.draw,
        data: pairs,
        recordsFiltered: pairs.length,
        recordsTotal: pairs.length
      });
    });

    app.get('/pairs/:exchange/:symbol/:action', async (req, res) => {
      const { exchange, symbol, action } = req.params;
      await this.pairsHttp.triggerOrder(exchange, symbol, action);

      // simple sleep for async ui blocking for exchange communication
      setTimeout(() => {
        res.redirect('/pairs');
      }, 800);
    });

    app.get('/logs', async (req, res) => {
      res.render('../templates/logs.html.twig', await this.logsHttp.getLogsPageVariables());
    });

    app.post('/logsTable', async (req, res) => {
      res.json(await this.logsHttp.getLogsData(req));
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

    const { exchangeManager } = this;
    app.delete('/orders/:exchange/:id', async (req, res) => {
      const { exchange, id } = req.params;

      const exchangeMgr = exchangeManager.get(exchange);

      try {
        await exchangeMgr.cancelOrder(id);
      } catch (e) {
        const error = `Cancel order error: ${JSON.stringify([exchange, id, String(e)])}`;
        console.log(error);
        res.json(JSON.stringify(error));
      }
      res.json({ [id]: 'OK' });
    });

    app.get('/orders/:pair/cancel-all', async (req, res) => {
      await this.ordersHttp.cancelAll(req.params.pair);
      res.redirect(`/orders/${req.params.pair}`);
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
        exchange: tradingview[0],
        pairs: this.ordersHttp.getPairs(),
        orders: await this.ordersHttp.getOrders(pair),
        position: await this.exchangeManager.getPosition(tradingview[0], tradingview[1]),
        ticker: ticker,
        tradingview: this.buildTradingViewSymbol(`${tradingview[0]}:${tradingview[1]}`),
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
        orders: await this.ordersHttp.getOrders(pair),
        ticker: ticker,
        position: await this.exchangeManager.getPosition(tradingview[0], tradingview[1]),
        form: form,
        tradingview: this.buildTradingViewSymbol(`${tradingview[0]}:${tradingview[1]}`),
        alert: {
          title: success ? 'Order Placed' : 'Place Error',
          type: success ? 'success' : 'danger',
          message: message
        }
      });
    });

    app.get('/trades', async (req, res) => {
      res.render('../templates/trades.html.twig', {});
    });

    app.get('/trades/positions', async (req, res) => {
      const positions = [];
      // TODO: Get rid of async calls in for loop
      for (const exchange of exchangeManager.all()) {
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

          if (req.query.search.value === '' || position.symbol.includes((req.query.search.value).toUpperCase())) {
            positions.push({
              exchange: exchangeName,
              position: position,
              currency: currencyValue,
              actions: 'close'
            });
          }
        });
      };
      res.json({
        draw: req.body.draw,
        data: positions,
        recordsFiltered: positions.length,
        recordsTotal: positions.length
      });
    });

    app.get('/trades/orders', async (req, res) => {
      const orders = [];
      // TODO: Get rid of async calls in for loop
      for (const exchange of exchangeManager.all()) {
        const myOrders = await exchange.getOrders();
        myOrders.forEach(order => {
          if (req.query.search.value === '' || order.symbol.includes(req.query.search.value.toUpperCase())) {
            orders.push({
              exchange: exchange.getName(),
              order: order,
              actions: 'cancel'
            });
          }
        });
      }
      res.json({ draw: req.body.draw, data: orders, recordsFiltered: orders.length, recordsTotal: orders.length });
    });

    const ip = this.systemUtil.getConfig('webserver.ip', '0.0.0.0');
    const port = this.systemUtil.getConfig('webserver.port', 8080);

    app.listen(port, ip);

    console.log(`Webserver listening on: ${ip}:${port}`);
  }

  /**
   * Tricky way to normalize our tradingview views
   *
   * eg:
   *  - binance_futures:BTCUSDT => binance:BTCUSDTPERP
   *  - binance_margin:BTCUSDT => binance:BTCUSDT
   *  - coinbase_pro:BTC-USDT => coinbase:BTCUSDT
   *
   * @param symbol
   * @returns {string}
   */
  buildTradingViewSymbol(symbol) {
    let mySymbol = symbol;

    // binance:BTCUSDTPERP
    if (mySymbol.includes('binance_futures')) {
      mySymbol = mySymbol.replace('binance_futures', 'binance');
      mySymbol += 'PERP';
    }

    return mySymbol
      .replace('-', '')
      .replace('coinbase_pro', 'coinbase')
      .replace('binance_margin', 'binance')
      .toUpperCase();
  }
};
