const compression = require('compression');
const express = require('express');
const layouts = require('express-ejs-layouts');
const auth = require('basic-auth');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const moment = require('moment');
const { OrderUtil } = require('../utils/order_util');
const path = require('path');

module.exports = class Http {
  constructor(systemUtil, ta, signalHttp, backtest, exchangeManager, pairsHttp, logsHttp, candleExportHttp, candleImporter, ordersHttp, tickers, projectDir) {
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
    this.tickers = tickers;

    // Helper functions for templates (previously Twig filters)
    this.templateHelpers = {
      priceFormat: value => {
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
      },
      formatDate: (date, format) => {
        if (!date) return '';

        // Handle Unix timestamps (convert seconds to milliseconds if needed)
        let dateValue = date;
        if (typeof date === 'number' && date < 10000000000) {
          // If it's a number less than 10 billion, it's likely in seconds
          dateValue = date * 1000;
        }

        const d = new Date(dateValue);

        // Check if date is valid
        if (isNaN(d.getTime())) return '';

        if (format === 'Y-m-d H:i') {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(
            2,
            '0'
          )}:${String(d.getMinutes()).padStart(2, '0')}`;
        } else if (format === 'y-m-d H:i:s') {
          return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(
            d.getHours()
          ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        } else if (format === 'd.m.y H:i') {
          return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)} ${String(
            d.getHours()
          ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return d.toISOString();
      },
      escapeHtml: text => {
        if (typeof text !== 'string') return text;
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      },
      decodeHtml: text => {
        if (typeof text !== 'string') return text;
        return text
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');
      },
      assetVersion: () => {
        return crypto
          .createHash('md5')
          .update(String(Math.floor(Date.now() / 1000)))
          .digest('hex')
          .substring(0, 8);
      },
      nodeVersion: () => process.version,
      memoryUsage: () => Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    };
  }

  start() {
    const app = express();

    // Configure EJS as template engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(this.projectDir, 'views'));

    // Configure express-ejs-layouts FIRST
    app.use(layouts);
    app.set('layout', 'layout');
    app.set('layout extractScripts', true);
    app.set('layout extractStyles', true);

    // Helper middleware to add template helpers to all renders
    // This must come AFTER express-ejs-layouts
    app.use((req, res, next) => {
      res.locals = {
        ...res.locals,
        ...this.templateHelpers,
        desks: this.systemUtil.getConfig('desks', []).map(d => d.name),
        nodeVersion: this.templateHelpers.nodeVersion(),
        memoryUsage: this.templateHelpers.memoryUsage(),
        assetVersion: this.templateHelpers.assetVersion()
      };
      next();
    });

    app.use(express.urlencoded({ limit: '12mb', extended: true, parameterLimit: 50000 }));
    app.use(cookieParser());
    app.use(compression());
    app.use(express.static(`${this.projectDir}/web/static`, { maxAge: 3600000 * 24 }));

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
      const data = await ta.getTaForPeriods(this.systemUtil.getConfig('dashboard.periods', ['15m', '1h']));
      res.render('dashboard', {
        activePage: 'dashboard',
        title: 'Dashboard | Crypto Bot',
        periods: data.periods,
        rows: Object.values(data.rows) // Convert object to array
      });
    });

    app.get('/backtest', async (req, res) => {
      res.render('backtest', {
        activePage: 'backtest',
        title: 'Backtesting | Crypto Bot',
        stylesheet:
          '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chosen/1.8.7/chosen.min.css" integrity="sha512-yVvxUQV0QESBt1SyZbNJMAwyKvFTLMyXSyBHDO4BG5t7k/Lw34tyqlSDlKIrIENIzCl+RVUNjmCPG+V/GMesRw==" crossorigin="anonymous" />',
        strategies: this.backtest.getBacktestStrategies(),
        pairs: await this.backtest.getBacktestPairs()
      });
    });

    app.post('/backtest/submit', async (req, res) => {
      let pairs = req.body.pair;

      if (typeof pairs === 'string') {
        pairs = [pairs];
      }

      const asyncs = pairs.map(pair => async () => {
        const p = pair.split('.');

        return {
          pair: pair,
          result: await this.backtest.getBacktestResult(
            parseInt(req.body.ticker_interval, 10),
            req.body.hours,
            req.body.strategy,
            req.body.candle_period,
            p[0],
            p[1],
            req.body.options ? JSON.parse(req.body.options) : {},
            req.body.initial_capital
          )
        };
      });

      const backtests = await Promise.all(asyncs.map(fn => fn()));

      // single details view
      if (backtests.length === 1) {
        res.render('backtest_submit', {
          activePage: 'backtest',
          title: 'Backtesting Results | Crypto Bot',
          stylesheet: '<link rel="stylesheet" href="/css/backtest.css?v=' + this.templateHelpers.assetVersion() + '">',
          ...backtests[0].result
        });
        return;
      }

      // multiple view
      res.render('backtest_submit_multiple', {
        activePage: 'backtest',
        title: 'Backtesting Results | Crypto Bot',
        stylesheet: '<link rel="stylesheet" href="/css/backtest.css?v=' + this.templateHelpers.assetVersion() + '">',
        backtests: backtests
      });
    });

    app.get('/tradingview/:symbol', (req, res) => {
      res.render('tradingview', {
        activePage: 'tradingview',
        title: `${req.params.symbol} | Trading View | Crypto Bot`,
        symbol: this.buildTradingViewSymbol(req.params.symbol)
      });
    });

    app.get('/signals', async (req, res) => {
      res.render('signals', {
        activePage: 'signals',
        title: 'Signals | Crypto Bot',
        signals: await this.signalHttp.getSignals(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30)
      });
    });

    app.get('/pairs', async (req, res) => {
      const pairs = await this.pairsHttp.getTradePairs();

      res.render('pairs', {
        activePage: 'pairs',
        title: 'Pairs | Crypto Bot',
        pairs: pairs,
        stats: {
          positions: pairs.filter(p => p.has_position === true).length,
          trading: pairs.filter(p => p.is_trading === true).length
        }
      });
    });

    app.get('/logs', async (req, res) => {
      const logData = await this.logsHttp.getLogsPageVariables(req, res);
      res.render('logs', {
        activePage: 'logs',
        title: 'Logs | Crypto Bot',
        ...logData
      });
    });

    app.get('/desks/:desk', async (req, res) => {
      res.render('desks', {
        activePage: 'desks',
        title: `Desk: ${this.systemUtil.getConfig('desks')[req.params.desk].name} | Crypto Bot`,
        desk: this.systemUtil.getConfig('desks')[req.params.desk],
        interval: req.query.interval || undefined,
        id: req.params.desk
      });
    });

    app.get('/desks/:desk/fullscreen', (req, res) => {
      const configElement = this.systemUtil.getConfig('desks')[req.params.desk];
      res.render('tradingview_desk', {
        layout: false,
        desk: configElement,
        interval: req.query.interval || undefined,
        id: req.params.desk,
        watchlist: configElement.pairs.map(i => i.symbol),
        desks: this.systemUtil.getConfig('desks', []).map(d => d.name)
      });
    });

    app.get('/tools/candles', async (req, res) => {
      const options = {
        pairs: await this.candleExportHttp.getPairs(),
        start: moment().subtract(7, 'days').toDate(),
        end: new Date()
      };

      if (req.query.pair && req.query.period && req.query.start && req.query.end) {
        const [exchange, symbol] = req.query.pair.split('.');
        const candles = await this.candleExportHttp.getCandles(exchange, symbol, req.query.period, new Date(req.query.start), new Date(req.query.end));

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

      res.render('candles', {
        activePage: 'candles',
        title: 'Candles | Crypto Bot',
        stylesheet:
          '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chosen/1.8.7/chosen.min.css" integrity="sha512-yVvxUQV0QESBt1SyZbNJMAwyKvFTLMyXSyBHDO4BG5t7k/Lw34tyqlSDlKIrIENIzCl+RVUNjmCPG+V/GMesRw==" crossorigin="anonymous" />',
        ...options
      });
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

      const symbol = req.params.pair.substring(pair[0].length + 1);

      await this.pairsHttp.triggerOrder(pair[0], symbol, body.action);

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
      res.render('orders/index', {
        activePage: 'orders',
        title: 'Orders | Crypto Bot',
        pairs: this.ordersHttp.getPairs()
      });
    });

    app.get('/orders/:pair', async (req, res) => {
      const { pair } = req.params;
      const tradingview = pair.split('.');

      const ticker = this.ordersHttp.getTicker(pair);

      res.render('orders/orders', {
        activePage: 'orders',
        title: `Order: ${pair} | Crypto Bot`,
        pair: pair,
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

      res.render('orders/orders', {
        activePage: 'orders',
        title: `Order: ${pair} | Crypto Bot`,
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

    app.get('/orders/:pair/cancel/:id', async (req, res) => {
      const foo = await this.ordersHttp.cancel(req.params.pair, req.params.id);
      res.redirect(`/orders/${encodeURIComponent(req.params.pair)}`);
    });

    app.get('/orders/:pair/cancel-all', async (req, res) => {
      await this.ordersHttp.cancelAll(req.params.pair);
      res.redirect(`/orders/${encodeURIComponent(req.params.pair)}`);
    });

    app.get('/trades', async (req, res) => {
      res.render('trades', {
        activePage: 'trades',
        title: 'Trades | Crypto Bot',
        javascript: `<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script><script src="https://cdn.jsdelivr.net/npm/vue3-sfc-loader/dist/vue3-sfc-loader.js"></script><script src="/js/trades.js?v=${this.templateHelpers.assetVersion()}" type="module"></script>`
      });
    });

    app.get('/trades.json', async (req, res) => {
      const positions = [];
      const orders = [];

      const exchanges = exchangeManager.all();
      for (const key in exchanges) {
        const exchange = exchanges[key];

        const exchangeName = exchange.getName();

        const myPositions = await exchange.getPositions();
        myPositions.forEach(position => {
          let currencyValue;
          let currencyProfit;

          if ((exchangeName.includes('bitmex') && ['XBTUSD', 'ETHUSD'].includes(position.symbol)) || exchangeName === 'bybit') {
            currencyValue = Math.abs(position.amount);
          } else if (position.amount && position.entry) {
            currencyValue = position.entry * Math.abs(position.amount);
          }

          positions.push({
            exchange: exchangeName,
            position: position,
            currency: currencyValue,
            currencyProfit: position.getProfit() ? currencyValue + (currencyValue / 100) * position.getProfit() : undefined
          });
        });

        const myOrders = await exchange.getOrders();
        myOrders.forEach(order => {
          const items = {
            exchange: exchange.getName(),
            order: order
          };

          const ticker = this.tickers.get(exchange.getName(), order.symbol);
          if (ticker) {
            items.percent_to_price = OrderUtil.getPercentDifferent(order.price, ticker.bid);
          }

          orders.push(items);
        });
      }

      res.json({
        orders: orders.sort((a, b) => a.order.symbol.localeCompare(b.order.symbol)),
        positions: positions.sort((a, b) => a.position.symbol.localeCompare(b.position.symbol))
      });
    });

    const ip = this.systemUtil.getConfig('webserver.ip', '0.0.0.0');
    const port = this.systemUtil.getConfig('webserver.port', 8080);

    app.listen(port, ip);

    console.log(`Webserver listening on: http://${ip}:${port}`);
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

    if (mySymbol.includes('bybit_unified') && mySymbol.endsWith(':USDT')) {
      mySymbol = mySymbol.replace(':USDT', '.P').replace('/', '');
    }

    if (mySymbol.includes('bybit_unified') && mySymbol.endsWith(':USDC')) {
      mySymbol = mySymbol.replace(':USDC', '.P').replace('/', '');
    }

    return mySymbol.replace('-', '').replace('coinbase_pro', 'coinbase').replace('binance_margin', 'binance').replace('bybit_unified', 'bybit').toUpperCase();
  }
};
