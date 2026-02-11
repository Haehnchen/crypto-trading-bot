import { BaseController, TemplateHelpers } from './base_controller';
import { PairsHttp } from '../modules/pairs/pairs_http';
import express from 'express';

export class PairsController extends BaseController {
  private pairsHttp: PairsHttp;

  constructor(templateHelpers: TemplateHelpers, pairsHttp: PairsHttp) {
    super(templateHelpers);
    this.pairsHttp = pairsHttp;
  }

  registerRoutes(router: express.Router): void {
    // List all pairs
    router.get('/pairs', async (req: any, res: any) => {
      const pairs = await this.pairsHttp.getTradePairs();

      res.render('pairs', {
        activePage: 'pairs',
        title: 'Pairs | Crypto Bot',
        pairs: pairs,
        stats: {
          positions: pairs.filter((p: any) => p.has_position === true).length,
          trading: pairs.filter((p: any) => p.is_trading === true).length
        }
      });
    });

    // Trigger order action on a pair
    router.post('/pairs/:pair', async (req: any, res: any) => {
      const pair = req.params.pair.split('-');
      const { body } = req;

      const symbol = req.params.pair.substring(pair[0].length + 1);

      await this.pairsHttp.triggerOrder(pair[0], symbol, body.action);

      setTimeout(() => {
        res.redirect('/pairs');
      }, 800);
    });
  }
}
