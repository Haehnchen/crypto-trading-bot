import { BaseController, TemplateHelpers } from './base_controller';
import { SignalHttp } from '../modules/signal/signal_http';
import express from 'express';

export class SignalsController extends BaseController {
  constructor(templateHelpers: TemplateHelpers, private signalHttp: SignalHttp) {
    super(templateHelpers);
  }

  registerRoutes(router: express.Router): void {
    router.get('/signals', async (req: any, res: any) => {
      res.render('signals', {
        activePage: 'signals',
        title: 'Signals | Crypto Bot',
        signals: await this.signalHttp.getSignals(Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 30)
      });
    });
  }
}
