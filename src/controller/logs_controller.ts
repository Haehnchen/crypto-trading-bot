import { BaseController, TemplateHelpers } from './base_controller';
import { LogsHttp } from '../modules/system/logs_http';
import express from 'express';

export class LogsController extends BaseController {
  private logsHttp: LogsHttp;

  constructor(templateHelpers: TemplateHelpers, logsHttp: LogsHttp) {
    super(templateHelpers);
    this.logsHttp = logsHttp;
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
