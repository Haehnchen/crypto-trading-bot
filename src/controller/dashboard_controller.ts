import { BaseController, TemplateHelpers } from './base_controller';
import { Ta } from '../modules/ta';
import { SystemUtil } from '../modules/system/system_util';
import express from 'express';

export class DashboardController extends BaseController {
  private ta: Ta;
  private systemUtil: SystemUtil;

  constructor(templateHelpers: TemplateHelpers, ta: Ta, systemUtil: SystemUtil) {
    super(templateHelpers);
    this.ta = ta;
    this.systemUtil = systemUtil;
  }

  registerRoutes(router: express.Router): void {
    router.get('/', async (req: any, res: any) => {
      const data = await this.ta.getTaForPeriods(this.systemUtil.getConfig('dashboard.periods', ['15m', '1h']));
      res.render('dashboard', {
        activePage: 'dashboard',
        title: 'Dashboard | Crypto Bot',
        periods: data.periods,
        rows: Object.values(data.rows)
      });
    });
  }
}
