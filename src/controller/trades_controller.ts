import { BaseController, TemplateHelpers } from './base_controller';
import { ExchangeManager } from '../modules/exchange/exchange_manager';
import { Tickers } from '../storage/tickers';
import { getPercentDifferent } from '../utils/order_util';
import express from 'express';

export class TradesController extends BaseController {
  constructor(
    templateHelpers: TemplateHelpers,
    private exchangeManager: ExchangeManager,
    private tickers: Tickers
  ) {
    super(templateHelpers);
  }

  registerRoutes(router: express.Router): void {
    // HTML view
    router.get('/trades', async (req: any, res: any) => {
      res.render('trades', {
        activePage: 'trades',
        title: 'Trades | Crypto Bot',
        javascript: `<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script><script src="https://cdn.jsdelivr.net/npm/vue3-sfc-loader/dist/vue3-sfc-loader.js"></script><script src="/js/trades.js?v=${this.templateHelpers.assetVersion()}" type="module"></script>`
      });
    });

    // JSON API
    router.get('/trades.json', async (req: any, res: any) => {
      const positions: any[] = [];
      const orders: any[] = [];

      const exchanges = this.exchangeManager.all();
      for (const key in exchanges) {
        const exchange = exchanges[key];
        const exchangeName = exchange.getName();

        const myPositions = await exchange.getPositions();
        myPositions.forEach((position: any) => {
          let currencyValue: number | undefined;

          if ((exchangeName.includes('bitmex') && ['XBTUSD', 'ETHUSD'].includes(position.symbol)) || exchangeName === 'bybit') {
            currencyValue = Math.abs(position.amount);
          } else if (position.amount && position.entry) {
            currencyValue = position.entry * Math.abs(position.amount);
          }

          positions.push({
            exchange: exchangeName,
            position: position,
            currency: currencyValue,
            currencyProfit: position.getProfit() ? (currencyValue || 0) + ((currencyValue || 0) / 100) * position.getProfit() : undefined
          });
        });

        const myOrders = await exchange.getOrders();
        myOrders.forEach((order: any) => {
          const items: any = {
            exchange: exchange.getName(),
            order: order
          };

          const ticker = this.tickers.get(exchange.getName(), order.symbol);
          if (ticker) {
            items.percent_to_price = getPercentDifferent(order.price, ticker.bid);
          }

          orders.push(items);
        });
      }

      res.json({
        orders: orders.sort((a: any, b: any) => a.order.symbol.localeCompare(b.order.symbol)),
        positions: positions.sort((a: any, b: any) => a.position.symbol.localeCompare(b.position.symbol))
      });
    });

    // Cancel order route (from trades view)
    router.get('/order/:exchange/:id', async (req: any, res: any) => {
      const exchangeName = req.params.exchange;
      const { id } = req.params;

      const exchange = this.exchangeManager.get(exchangeName);

      try {
        await exchange.cancelOrder(id);
      } catch (e) {
        console.log(`Cancel order error: ${JSON.stringify([exchangeName, id, String(e)])}`);
      }

      res.redirect('/trades');
    });
  }
}
