import { BaseController, TemplateHelpers } from './base_controller';
import { LogsHttp } from '../modules/system/logs_http';
import express from 'express';

export class LogsController extends BaseController {
  constructor(templateHelpers: TemplateHelpers, private logsHttp: LogsHttp) {
    super(templateHelpers);
  }

  registerRoutes(router: express.Router): void {
    router.get('/logs', async (req: any, res: any) => {
      const logData = await this.logsHttp.getLogsPageVariables(req, res);
      res.render('logs', {
        activePage: 'logs',
        title: 'Logs | Crypto Bot',
        ...logData
      });
    });
  }
}
