import moment from 'moment';
import { BaseController, TemplateHelpers } from './base_controller';
import { CandleExportHttp } from '../modules/system/candle_export_http';
import { CandleImporter } from '../modules/system/candle_importer';
import express from 'express';

export class CandlesController extends BaseController {
  constructor(templateHelpers: TemplateHelpers, private candleExportHttp: CandleExportHttp, private candleImporter: CandleImporter) {
    super(templateHelpers);
  }

  registerRoutes(router: express.Router): void {
    // GET - Display candle form and data
    router.get('/tools/candles', async (req: any, res: any) => {
      const options: any = {
        pairs: await this.candleExportHttp.getPairs(),
        start: moment().subtract(7, 'days').toDate(),
        end: new Date()
      };

      if (req.query.pair && req.query.period && req.query.start && req.query.end) {
        const [exchange, symbol] = req.query.pair.split('.');
        const candles = await this.candleExportHttp.getCandles(exchange, symbol, req.query.period, new Date(req.query.start), new Date(req.query.end));

        if (req.query.metadata) {
          candles.map((c: any) => {
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

    // POST - Import candles
    router.post('/tools/candles', async (req: any, res: any) => {
      const exchangeCandlesticks = JSON.parse(req.body.json);
      await this.candleImporter.insertCandles(exchangeCandlesticks);

      console.log(`Imported: ${exchangeCandlesticks.length} items`);

      res.redirect('/tools/candles');
    });
  }
}
