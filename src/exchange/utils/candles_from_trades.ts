import { ExchangeCandlestick } from '../../dict/exchange_candlestick';

export interface Trade {
  price: number;
  amount: number;
  symbol: string;
  timestamp: number;
}

export interface SymbolConfig {
  symbol: string;
  periods: string[];
}

export interface CandlestickResample {
  resample(exchange: string, symbol: string, periodFrom: string, periodTo: string, limitCandles: boolean): Promise<void>;
}

export interface CandleImporter {
  insertThrottledCandles(candles: ExchangeCandlestick[]): Promise<void>;
}

interface InternalCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closed: boolean;
}

export class CandlesFromTrades {
  private candlestickResample: CandlestickResample;
  private candleImporter: CandleImporter;
  private candles: Record<string, Record<number, InternalCandle>>;
  private lastCandleMap: Record<string, InternalCandle>;

  constructor(candlestickResample: CandlestickResample, candleImporter: CandleImporter) {
    this.candlestickResample = candlestickResample;
    this.candleImporter = candleImporter;

    this.candles = {};
    this.lastCandleMap = {};
  }

  async onTrades(exchangeName: string, trades: Trade[], symbols: SymbolConfig[] = []): Promise<void> {
    for (const trade of trades) {
      await this.onTrade(exchangeName, trade, symbols);
    }
  }

  /**
   * Exchanges like coinbase does not deliver candles via websocket, so we fake them on the public order history (websocket)
   *
   * @param exchangeName string
   * @param trade array
   * @param symbols array for calculate the resamples
   */
  async onTrade(exchangeName: string, trade: Trade, symbols: SymbolConfig[] = []): Promise<void> {
    if (!trade.price || !trade.amount || !trade.symbol || !trade.timestamp) {
      return;
    }

    // Price and volume are sent as strings by the API
    trade.price = parseFloat(trade.price.toString());
    trade.amount = parseFloat(trade.amount.toString());

    const { symbol } = trade;

    // Round the time to the nearest minute, Change as per your resolution
    const roundedTime = Math.floor(new Date(trade.timestamp) / 60000.0) * 60;

    // If the candles hashmap doesnt have this product id create an empty object for that id
    if (!this.candles[symbol]) {
      this.candles[symbol] = {};
    }

    // candle still open just modify it
    if (this.candles[symbol][roundedTime]) {
      // If this timestamp exists in our map for the product id, we need to update an existing candle
      const candle = this.candles[symbol][roundedTime];

      candle.high = trade.price > candle.high ? trade.price : candle.high;
      candle.low = trade.price < candle.low ? trade.price : candle.low;
      candle.close = trade.price;
      candle.volume = parseFloat((candle.volume + trade.amount).toFixed(8));

      // Set the last candle as the one we just updated
      this.lastCandleMap[symbol] = candle;

      return;
    }

    // Before creating a new candle, lets mark the old one as closed
    const lastCandle = this.lastCandleMap[symbol];

    if (lastCandle) {
      lastCandle.closed = true;
      delete this.candles[symbol][lastCandle.timestamp];
    }

    this.candles[symbol][roundedTime] = {
      timestamp: roundedTime,
      open: trade.price,
      high: trade.price,
      low: trade.price,
      close: trade.price,
      volume: trade.amount,
      closed: false
    };

    const ourCandles: ExchangeCandlestick[] = [];
    for (const timestamp in this.candles[symbol]) {
      const candle = this.candles[symbol][timestamp];

      ourCandles.push(
        new ExchangeCandlestick(
          exchangeName,
          symbol,
          '1m',
          candle.timestamp,
          candle.open,
          candle.high,
          candle.low,
          candle.close,
          candle.volume
        )
      );
    }

    // delete old candles
    Object.keys(this.candles[symbol])
      .sort((a, b) => Number(b) - Number(a))
      .slice(200)
      .forEach(i => {
        delete this.candles[symbol][i];
      });

    await this.candleImporter.insertThrottledCandles(ourCandles);

    let resamples = [];

    const symbolCfg = symbols.find(s => s.symbol === symbol);
    if (symbolCfg) {
      resamples = symbolCfg.periods.filter(r => r !== '1m');
    }

    // wait for insert of previous database inserts
    await Promise.all(
      resamples.map(async resamplePeriod => {
        await this.candlestickResample.resample(exchangeName, symbol, '1m', resamplePeriod, true);
      })
    );
  }
}
