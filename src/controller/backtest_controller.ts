import { BaseController, TemplateHelpers } from './base_controller';
import { Backtest } from '../modules/backtest';
import express from 'express';

export class BacktestController extends BaseController {
  constructor(templateHelpers: TemplateHelpers, private backtest: Backtest) {
    super(templateHelpers);
  }

  registerRoutes(router: express.Router): void {
    // Backtest form page
    router.get('/backtest', async (req: any, res: any) => {
      res.render('backtest', {
        activePage: 'backtest',
        title: 'Backtesting | Crypto Bot',
        stylesheet:
          '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/chosen/1.8.7/chosen.min.css" integrity="sha512-yVvxUQV0QESBt1SyZbNJMAwyKvFTLMyXSyBHDO4BG5t7k/Lw34tyqlSDlKIrIENIzCl+RVUNjmCPG+V/GMesRw==" crossorigin="anonymous" />',
        strategies: this.backtest.getBacktestStrategies(),
        pairs: await this.backtest.getBacktestPairs()
      });
    });

    // Backtest submit
    router.post('/backtest/submit', async (req: any, res: any) => {
      let pairs = req.body.pair;

      if (typeof pairs === 'string') {
        pairs = [pairs];
      }

      const asyncs = pairs.map((pair: string) => async () => {
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

      const backtests = await Promise.all(asyncs.map((fn: any) => fn()));

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
  }
}
