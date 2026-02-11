import { BaseController, TemplateHelpers } from './base_controller';
import express from 'express';

export class TradingViewController extends BaseController {
  constructor(templateHelpers: TemplateHelpers) {
    super(templateHelpers);
  }

  registerRoutes(router: express.Router): void {
    router.get('/tradingview/:symbol', (req: any, res: any) => {
      res.render('tradingview', {
        activePage: 'tradingview',
        title: `${req.params.symbol} | Trading View | Crypto Bot`,
        symbol: this.buildTradingViewSymbol(req.params.symbol)
      });
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
