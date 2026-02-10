const request = require('request');

export interface TradingPair {
  symbol: string;
  periods: string[];
  exchange: string;
}

export interface BinanceSymbol {
  symbol: string;
  quoteAsset: string;
  baseAsset: string;
  status: string;
  isMarginTradingAllowed?: boolean;
}

export interface BitmexInstrument {
  symbol: string;
  typ: string;
}

export interface BinanceFuturesSymbol {
  symbol: string;
  status: string;
  contractType: string;
  contractStatus?: string;
}

export interface BybitSymbol {
  symbol: string;
  name: string;
  alias: string;
  quote_currency: string;
}

export interface BybitV5Ticker {
  symbol: string;
  turnover24h: number;
}

export type PairCallback = (result: TradingPair, pair: any) => TradingPair | undefined | void;

async function binanceInitUsDt(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://api.binance.com/api/v1/exchangeInfo', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      let content: any;
      try {
        content = JSON.parse(body);
      } catch (e) {
        console.log(`Binance init issues: ${String(e)} ${body}`);
        resolve([]);
        return;
      }

      if (!content.symbols) {
        console.log(`Binance symbol format issues: ${body}`);
        resolve([]);
        return;
      }

      content.symbols
        .filter(
          (p: BinanceSymbol) =>
            ['USDT'].includes(p.quoteAsset) &&
            !['USDC', 'PAX', 'USDS', 'TUSD', 'BUSD'].includes(p.baseAsset) &&
            p.status.toLowerCase() === 'trading'
        )
        .forEach((pair: BinanceSymbol) => {
          let result: TradingPair = {
            symbol: pair.symbol,
            periods: ['1m', '15m', '1h'],
            exchange: 'binance'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function binanceInitBusd(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://api.binance.com/api/v1/exchangeInfo', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      let content: any;
      try {
        content = JSON.parse(body);
      } catch (e) {
        console.log(`Binance init issues: ${String(e)} ${body}`);
        resolve([]);
        return;
      }

      if (!content.symbols) {
        console.log(`Binance symbol format issues: ${body}`);
        resolve([]);
        return;
      }

      content.symbols
        .filter(
          (p: BinanceSymbol) =>
            ['BUSD'].includes(p.quoteAsset) &&
            !['USDC', 'PAX', 'USDS', 'TUSD', 'USDT'].includes(p.baseAsset) &&
            p.status.toLowerCase() === 'trading'
        )
        .forEach((pair: BinanceSymbol) => {
          let result: TradingPair = {
            symbol: pair.symbol,
            periods: ['1m', '15m', '1h'],
            exchange: 'binance'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function binanceInitBNB(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://api.binance.com/api/v1/exchangeInfo', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      let content: any;
      try {
        content = JSON.parse(body);
      } catch (e) {
        console.log(`Binance init issues: ${String(e)} ${body}`);
        resolve([]);
        return;
      }

      if (!content.symbols) {
        console.log(`Binance symbol format issues: ${body}`);
        resolve([]);
        return;
      }

      content.symbols
        .filter(
          (p: BinanceSymbol) =>
            ['BNB'].includes(p.quoteAsset) &&
            !['BUSD', 'USDC', 'PAX', 'USDS', 'TUSD', 'USDT'].includes(p.baseAsset) &&
            p.status.toLowerCase() === 'trading'
        )
        .forEach((pair: BinanceSymbol) => {
          let result: TradingPair = {
            symbol: pair.symbol,
            periods: ['1m', '15m', '1h'],
            exchange: 'binance'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function binanceInitBTC(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://api.binance.com/api/v1/exchangeInfo', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      let content: any;
      try {
        content = JSON.parse(body);
      } catch (e) {
        console.log(`Binance init issues: ${String(e)} ${body}`);
        resolve([]);
        return;
      }

      if (!content.symbols) {
        console.log(`Binance symbol format issues: ${body}`);
        resolve([]);
        return;
      }

      content.symbols
        .filter(
          (p: BinanceSymbol) =>
            ['BTC'].includes(p.quoteAsset) &&
            !['BUSD', 'USDC', 'PAX', 'USDS', 'TUSD', 'USDT'].includes(p.baseAsset) &&
            p.status.toLowerCase() === 'trading'
        )
        .forEach((pair: BinanceSymbol) => {
          let result: TradingPair = {
            symbol: pair.symbol,
            periods: ['1m', '15m', '1h'],
            exchange: 'binance'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function binanceInitETH(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://api.binance.com/api/v1/exchangeInfo', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      let content: any;
      try {
        content = JSON.parse(body);
      } catch (e) {
        console.log(`Binance init issues: ${String(e)} ${body}`);
        resolve([]);
        return;
      }

      if (!content.symbols) {
        console.log(`Binance symbol format issues: ${body}`);
        resolve([]);
        return;
      }

      content.symbols
        .filter(
          (p: BinanceSymbol) =>
            ['ETH'].includes(p.quoteAsset) &&
            !['BUSD', 'USDC', 'PAX', 'USDS', 'TUSD', 'USDT'].includes(p.baseAsset) &&
            p.status.toLowerCase() === 'trading'
        )
        .forEach((pair: BinanceSymbol) => {
          let result: TradingPair = {
            symbol: pair.symbol,
            periods: ['1m', '15m', '1h'],
            exchange: 'binance'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function binancecrossMarginPairsUsdT(): Promise<string[]> {
  return new Promise(resolve => {
    request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error: any, _res: any, body: string) => {
      const content = JSON.parse(body);
      const crossMarginPairsUsdT = content.data.map((i: any) => i.assetName);
      resolve(crossMarginPairsUsdT);
    });
  });
}

async function binancecrossMarginPairsBusd(): Promise<string[]> {
  return new Promise(resolve => {
    request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error: any, _res: any, body: string) => {
      const content = JSON.parse(body);
      const crossMarginPairsBusd = content.data.map((i: any) => i.assetName);
      resolve(crossMarginPairsBusd);
    });
  });
}

async function binancecrossMarginPairsBNB(): Promise<string[]> {
  return new Promise(resolve => {
    request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error: any, _res: any, body: string) => {
      const content = JSON.parse(body);
      const crossMarginPairsBNB = content.data.map((i: any) => i.assetName);
      resolve(crossMarginPairsBNB);
    });
  });
}

async function binancecrossMarginPairsBTC(): Promise<string[]> {
  return new Promise(resolve => {
    request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error: any, _res: any, body: string) => {
      const content = JSON.parse(body);
      const crossMarginPairsBTC = content.data.map((i: any) => i.assetName);
      resolve(crossMarginPairsBTC);
    });
  });
}

async function binancecrossMarginPairsETH(): Promise<string[]> {
  return new Promise(resolve => {
    request('https://www.binance.com/gateway-api/v1/friendly/margin/vip/spec/list-all', (_error: any, _res: any, body: string) => {
      const content = JSON.parse(body);
      const crossMarginPairsETH = content.data.map((i: any) => i.assetName);
      resolve(crossMarginPairsETH);
    });
  });
}

async function binanceInitSpotUsdT(callback?: PairCallback, filterCrossMargin: boolean = true): Promise<TradingPair[]> {
  const crossMarginPairsUsdT = await binancecrossMarginPairsUsdT();

  return binanceInitUsDt((result, pair) => {
    if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsUsdT.includes(pair.baseAsset)) {
      return undefined;
    }

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function binanceInitSpotBusd(callback?: PairCallback, filterCrossMargin: boolean = true): Promise<TradingPair[]> {
  const crossMarginPairsBusd = await binancecrossMarginPairsBusd();

  return binanceInitBusd((result, pair) => {
    if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsBusd.includes(pair.baseAsset)) {
      return undefined;
    }

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function binanceInitSpotBNB(callback?: PairCallback, filterCrossMargin: boolean = true): Promise<TradingPair[]> {
  const crossMarginPairsBNB = await binancecrossMarginPairsBNB();

  return binanceInitBNB((result, pair) => {
    if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsBNB.includes(pair.baseAsset)) {
      return undefined;
    }

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function binanceInitSpotBTC(callback?: PairCallback, filterCrossMargin: boolean = true): Promise<TradingPair[]> {
  const crossMarginPairsBTC = await binancecrossMarginPairsBTC();

  return binanceInitBTC((result, pair) => {
    if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsBTC.includes(pair.baseAsset)) {
      return undefined;
    }

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function binanceInitSpotETH(callback?: PairCallback, filterCrossMargin: boolean = true): Promise<TradingPair[]> {
  const crossMarginPairsETH = await binancecrossMarginPairsETH();

  return binanceInitETH((result, pair) => {
    if (filterCrossMargin && pair.isMarginTradingAllowed && crossMarginPairsETH.includes(pair.baseAsset)) {
      return undefined;
    }

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function binanceInitMarginUsdT(callback?: PairCallback): Promise<TradingPair[]> {
  const crossMarginPairsUsdT = await binancecrossMarginPairsUsdT();

  return binanceInitUsDt((result, pair) => {
    if (!pair.isMarginTradingAllowed || !crossMarginPairsUsdT.includes(pair.baseAsset)) {
      return undefined;
    }

    result.exchange = 'binance_margin';

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function binanceInitMarginBusd(callback?: PairCallback): Promise<TradingPair[]> {
  const crossMarginPairsBusd = await binancecrossMarginPairsBusd();

  return binanceInitBusd((result, pair) => {
    if (!pair.isMarginTradingAllowed || !crossMarginPairsBusd.includes(pair.baseAsset)) {
      return undefined;
    }

    result.exchange = 'binance_margin';

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function binanceInitMarginBTC(callback?: PairCallback): Promise<TradingPair[]> {
  const crossMarginPairsBTC = await binancecrossMarginPairsBTC();

  return binanceInitBTC((result, pair) => {
    if (!pair.isMarginTradingAllowed || !crossMarginPairsBTC.includes(pair.baseAsset)) {
      return undefined;
    }

    result.exchange = 'binance_margin';

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function binanceInitMarginETH(callback?: PairCallback): Promise<TradingPair[]> {
  const crossMarginPairsETH = await binancecrossMarginPairsETH();

  return binanceInitETH((result, pair) => {
    if (!pair.isMarginTradingAllowed || !crossMarginPairsETH.includes(pair.baseAsset)) {
      return undefined;
    }

    result.exchange = 'binance_margin';

    if (!callback) {
      return result;
    }

    return callback(result, pair);
  });
}

async function bitmexInit(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://www.bitmex.com/api/v1/instrument/active', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      const content = JSON.parse(body);

      content
        .filter((p: BitmexInstrument) => ['FFCCSX', 'FFWCSX'].includes(p.typ))
        .forEach((pair: BitmexInstrument) => {
          let result: TradingPair = {
            symbol: pair.symbol,
            periods: ['1m', '15m', '1h'],
            exchange: 'bitmex'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function binanceFuturesInit(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://fapi.binance.com/fapi/v1/exchangeInfo', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      const content = JSON.parse(body);

      content.symbols
        .filter((p: BinanceFuturesSymbol) => p.status.toUpperCase() === 'TRADING' && p.contractType.toUpperCase() === 'PERPETUAL')
        .forEach((pair: BinanceFuturesSymbol) => {
          let result: TradingPair = {
            symbol: pair.symbol,
            periods: ['1m', '15m', '1h'],
            exchange: 'binance_futures'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function binanceFuturesCoin(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://dapi.binance.com/dapi/v1/exchangeInfo', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      const content = JSON.parse(body);

      content.symbols
        .filter((p: BinanceFuturesSymbol) => p.contractStatus!.toUpperCase() === 'TRADING' && p.contractType.toUpperCase() === 'PERPETUAL')
        .forEach((pair: BinanceFuturesSymbol) => {
          let result: TradingPair = {
            symbol: pair.symbol,
            periods: ['15m', '1h'],
            exchange: 'binance_futures_coin'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function bybitLinearCoin(callback?: PairCallback, limit: number = 100): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://api.bybit.com/v5/market/tickers?category=linear', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      const content = JSON.parse(body);

      const arr = (content?.result?.list || [])
        .filter((p: BybitV5Ticker) => p.symbol.toUpperCase().endsWith('USDT'))
        .sort((a: BybitV5Ticker, b: BybitV5Ticker) => b.turnover24h - a.turnover24h);

      arr.slice(0, limit).forEach((pair: BybitV5Ticker) => {
        let result: TradingPair = {
          symbol: `${pair.symbol.substring(0, pair.symbol.length - 4)}/USDT:USDT`,
          periods: ['15m', '1h'],
          exchange: 'bybit_unified'
        };

        if (callback) {
          result = callback(result, pair) as TradingPair;
        }

        if (result) {
          pairs.push(result);
        }
      });

      resolve(pairs);
    });
  });
}

async function bitfinexUsdMarginInit(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://api.bitfinex.com/v1/symbols_details', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      const content = JSON.parse(body);

      content
        .filter((p: any) => p.margin === true && p.pair.endsWith('usd') && !p.pair.startsWith('USD'))
        .forEach((pair: any) => {
          let result: TradingPair = {
            symbol: pair.pair.toUpperCase(),
            periods: ['1m', '15m', '1h'],
            exchange: 'bitfinex'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

async function bybitInit(callback?: PairCallback): Promise<TradingPair[]> {
  return new Promise(resolve => {
    request('https://api.bybit.com/v2/public/symbols', (_error: any, _res: any, body: string) => {
      const pairs: TradingPair[] = [];

      let content: any;
      try {
        content = JSON.parse(body);
      } catch (e) {
        console.log(`Bybit init issues: ${String(e)} ${body}`);
        resolve([]);
        return;
      }

      if (!content?.result) {
        console.log(`Bybit init issues: ${JSON.stringify(content)}`);
        resolve([]);
        return;
      }

      content.result
        .filter((p: BybitSymbol) => ['USD'].includes(p.quote_currency))
        .forEach((pair: BybitSymbol) => {
          if (pair.name !== pair.alias) {
            console.log(`Bybit: Skip pair init; alias feature not supported: "${pair.name}" - "${pair.alias}"`);
            return;
          }

          let result: TradingPair = {
            symbol: pair.name,
            periods: ['1m', '15m', '1h'],
            exchange: 'bybit'
          };

          if (callback) {
            result = callback(result, pair) as TradingPair;
          }

          if (result) {
            pairs.push(result);
          }
        });

      resolve(pairs);
    });
  });
}

module.exports = {
  binanceInitUsDt,
  binanceInitBusd,
  binanceInitBNB,
  binanceInitBTC,
  binanceInitETH,
  binanceInitSpotUsdT,
  binanceInitSpotBusd,
  binanceInitSpotBNB,
  binanceInitSpotBTC,
  binanceInitSpotETH,
  binancecrossMarginPairsUsdT,
  binancecrossMarginPairsBusd,
  binancecrossMarginPairsBNB,
  binancecrossMarginPairsBTC,
  binancecrossMarginPairsETH,
  binanceInitMarginUsdT,
  binanceInitMarginBusd,
  binanceInitMarginBTC,
  binanceInitMarginETH,
  bitmexInit,
  binanceFuturesInit,
  binanceFuturesCoin,
  bybitLinearCoin,
  bitfinexUsdMarginInit,
  bybitInit
};

