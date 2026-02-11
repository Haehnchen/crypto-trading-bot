import { BaseController, TemplateHelpers } from './base_controller';
import { OrdersHttp } from '../modules/orders/orders_http';
import { ExchangeManager } from '../modules/exchange/exchange_manager';
import express from 'express';

export class OrdersController extends BaseController {
  private ordersHttp: OrdersHttp;
  private exchangeManager: ExchangeManager;

  constructor(templateHelpers: TemplateHelpers, ordersHttp: OrdersHttp, exchangeManager: ExchangeManager) {
    super(templateHelpers);
    this.ordersHttp = ordersHttp;
    this.exchangeManager = exchangeManager;
  }

  registerRoutes(router: express.Router): void {
    // Orders index page
    router.get('/orders', async (req: any, res: any) => {
      res.render('orders/index', {
        activePage: 'orders',
        title: 'Orders | Crypto Bot',
        pairs: this.ordersHttp.getPairs()
      });
    });

    // Orders for a specific pair
    router.get('/orders/:pair', async (req: any, res: any) => {
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

    // Create order for a pair
    router.post('/orders/:pair', async (req: any, res: any) => {
      const { pair } = req.params;
      const tradingview = pair.split('.');

      const ticker = this.ordersHttp.getTicker(pair);
      const form = req.body;

      let success = true;
      let message: string;
      let result: any;

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

    // Cancel specific order
    router.get('/orders/:pair/cancel/:id', async (req: any, res: any) => {
      await this.ordersHttp.cancel(req.params.pair, req.params.id);
      res.redirect(`/orders/${encodeURIComponent(req.params.pair)}`);
    });

    // Cancel all orders for a pair
    router.get('/orders/:pair/cancel-all', async (req: any, res: any) => {
      await this.ordersHttp.cancelAll(req.params.pair);
      res.redirect(`/orders/${encodeURIComponent(req.params.pair)}`);
    });
  }

  /**
   * Tricky way to normalize our tradingview views
   */
  private buildTradingViewSymbol(symbol: string): string {
    let mySymbol = symbol;

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
}
