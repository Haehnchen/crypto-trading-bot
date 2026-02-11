import { BaseController, TemplateHelpers } from './base_controller';
import { SystemUtil } from '../modules/system/system_util';
import express from 'express';

export class DesksController extends BaseController {
  private systemUtil: SystemUtil;

  constructor(templateHelpers: TemplateHelpers, systemUtil: SystemUtil) {
    super(templateHelpers);
    this.systemUtil = systemUtil;
  }

  registerRoutes(router: express.Router): void {
    // Desk view
    router.get('/desks/:desk', async (req: any, res: any) => {
      res.render('desks', {
        activePage: 'desks',
        title: `Desk: ${this.systemUtil.getConfig('desks')[req.params.desk].name} | Crypto Bot`,
        desk: this.systemUtil.getConfig('desks')[req.params.desk],
        interval: req.query.interval || undefined,
        id: req.params.desk
      });
    });

    // Desk fullscreen view
    router.get('/desks/:desk/fullscreen', (req: any, res: any) => {
      const configElement = this.systemUtil.getConfig('desks')[req.params.desk];
      res.render('tradingview_desk', {
        layout: false,
        desk: configElement,
        interval: req.query.interval || undefined,
        id: req.params.desk,
        watchlist: configElement.pairs.map((i: any) => i.symbol),
        desks: this.systemUtil.getConfig('desks', []).map((d: any) => d.name)
      });
    });
  }
}
