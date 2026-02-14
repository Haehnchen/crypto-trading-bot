import assert from 'assert';
import fs from 'fs';
import * as path from 'path';
import { indicators, Candlestick, Indicator } from '../../src/utils/indicators';

/**
 * Test fixture: BTC/USD 5m candles
 *
 * IMPORTANT: This fixture is in DESC order (newest first)
 * Indicators expect ASC order (oldest first)
 * Tests must reverse the data before use
 */
function createCandleFixtures(): Candlestick[] {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/xbt-usd-5m.json'), 'utf8'));
}

/**
 * Convert DESC candles to ASC order (oldest first)
 * This is what indicators expect
 */
function toAscOrder(candles: Candlestick[]): Candlestick[] {
  return candles.slice().reverse();
}

/**
 * Get close prices from candles (ASC order)
 */
function getClosePrices(candles: Candlestick[]): number[] {
  return candles.map(c => c.close);
}

describe('#indicators', () => {
  let candles: Candlestick[];
  let candlesAsc: Candlestick[];
  let closePrices: number[];

  beforeEach(() => {
    candles = createCandleFixtures();
    candlesAsc = toAscOrder(candles);
    closePrices = getClosePrices(candlesAsc);
  });

  describe('candle ordering', () => {
    it('fixture is DESC order (newest first)', () => {
      assert.equal(candles[0].time > candles[1].time, true, 'Fixture should be DESC order');
    });

    it('ASC conversion works correctly', () => {
      assert.equal(candlesAsc[0].time < candlesAsc[1].time, true, 'ASC order: oldest first');
      assert.equal(candlesAsc[0].time, 1532996700, 'First candle should be oldest (2018-07-31T00:25:00)');
    });

    it('indicators receive correct order validation', () => {
      // This would throw if we passed DESC order to createIndicatorsLookback
      // But we test indicators directly here, so we document the expectation
      assert.equal(candlesAsc[0].time < candlesAsc[candlesAsc.length - 1].time, true);
    });
  });

  describe('sma', () => {
    it('calculates simple moving average', async () => {
      const result = await indicators.sma(closePrices, { key: 'sma', indicator: 'sma', options: { length: 14 } });
      assert.equal(result.sma.length > 0, true);
      assert.equal(typeof result.sma[0], 'number');
    });

    it('returns correct number of values', async () => {
      const result = await indicators.sma(closePrices, { key: 'sma', indicator: 'sma', options: { length: 14 } });
      // SMA 14 produces length - 14 + 1 values
      assert.equal(result.sma.length, closePrices.length - 14 + 1);
    });
  });

  describe('ema', () => {
    it('calculates exponential moving average', async () => {
      const result = await indicators.ema(closePrices, { key: 'ema', indicator: 'ema', options: { length: 14 } });
      assert.equal(result.ema.length > 0, true);
      assert.equal(typeof result.ema[0], 'number');
    });
  });

  describe('rsi', () => {
    it('calculates relative strength index', async () => {
      const result = await indicators.rsi(closePrices, { key: 'rsi', indicator: 'rsi', options: { length: 14 } });
      assert.equal(result.rsi.length > 0, true);
      assert.equal(typeof result.rsi[0], 'number');
      // RSI should be between 0 and 100
      assert.equal(result.rsi[0] >= 0 && result.rsi[0] <= 100, true, `RSI should be 0-100, got ${result.rsi[0]}`);
    });
  });

  describe('bb (bollinger bands)', () => {
    it('calculates bollinger bands with upper, middle, lower, width', async () => {
      const result = await indicators.bb(closePrices, { key: 'bb', indicator: 'bb', options: { length: 20, stddev: 2 } });
      assert.equal(result.bb.length > 0, true);

      const firstResult = result.bb[0] as any;
      assert.equal('upper' in firstResult, true, 'Should have upper');
      assert.equal('middle' in firstResult, true, 'Should have middle');
      assert.equal('lower' in firstResult, true, 'Should have lower');
      assert.equal('width' in firstResult, true, 'Should have width');

      assert.equal(firstResult.lower < firstResult.middle, true, 'lower < middle');
      assert.equal(firstResult.middle < firstResult.upper, true, 'middle < upper');
      assert.equal(firstResult.width > 0, true, 'width > 0');
    });
  });

  describe('macd', () => {
    it('calculates MACD with macd, signal, histogram', async () => {
      const result = await indicators.macd(closePrices, {
        key: 'macd',
        indicator: 'macd',
        options: { fast_length: 12, slow_length: 26, signal_length: 9 }
      });
      assert.equal(result.macd.length > 0, true);

      const firstResult = result.macd[0] as any;
      assert.equal('macd' in firstResult, true, 'Should have macd');
      assert.equal('signal' in firstResult, true, 'Should have signal');
      assert.equal('histogram' in firstResult, true, 'Should have histogram');
    });
  });

  describe('atr', () => {
    it('calculates average true range from candles', async () => {
      const result = await indicators.atr(candlesAsc, { key: 'atr', indicator: 'atr', options: { length: 14 } });
      assert.equal(result.atr.length > 0, true);
      assert.equal(result.atr[0]! > 0, true, 'ATR should be positive');
    });
  });

  describe('stoch', () => {
    it('calculates stochastic oscillator with k and d', async () => {
      const result = await indicators.stoch(candlesAsc, { key: 'stoch', indicator: 'stoch' });
      assert.equal(result.stoch.length > 0, true);

      const firstResult = result.stoch[0] as any;
      assert.equal('stoch_k' in firstResult, true, 'Should have stoch_k');
      assert.equal('stoch_d' in firstResult, true, 'Should have stoch_d');
      // Stochastic should be between 0 and 100
      assert.equal(firstResult.stoch_k >= 0 && firstResult.stoch_k <= 100, true);
    });
  });

  describe('hma (hull moving average)', () => {
    it('calculates HMA from candles (default: close)', async () => {
      const result = await indicators.hma(candlesAsc, { key: 'hma', indicator: 'hma', options: { length: 9 } });
      assert.equal(result.hma.length > 0, true);
      assert.equal(typeof result.hma[0], 'number');
      assert.equal(result.hma[0]! > 0, true, 'HMA should be positive for price data');
    });

    it('calculates HMA from low source', async () => {
      const result = await indicators.hma(candlesAsc, {
        key: 'hma',
        indicator: 'hma',
        options: { length: 9, source: 'low' }
      });
      assert.equal(result.hma.length > 0, true);
      assert.equal(result.hma[0]! > 0, true);
    });
  });

  describe('wma', () => {
    it('calculates weighted moving average', async () => {
      const result = await indicators.wma(closePrices, { key: 'wma', indicator: 'wma', options: { length: 9 } });
      assert.equal(result.wma.length > 0, true);
      assert.equal(typeof result.wma[0], 'number');
    });
  });

  describe('dema', () => {
    it('calculates double exponential moving average', async () => {
      const result = await indicators.dema(closePrices, { key: 'dema', indicator: 'dema', options: { length: 9 } });
      assert.equal(result.dema.length > 0, true);
      assert.equal(typeof result.dema[0], 'number');
    });
  });

  describe('tema', () => {
    it('calculates triple exponential moving average', async () => {
      const result = await indicators.tema(closePrices, { key: 'tema', indicator: 'tema', options: { length: 9 } });
      assert.equal(result.tema.length > 0, true);
      assert.equal(typeof result.tema[0], 'number');
    });
  });

  describe('trima', () => {
    it('calculates triangular moving average', async () => {
      const result = await indicators.trima(closePrices, { key: 'trima', indicator: 'trima', options: { length: 9 } });
      assert.equal(result.trima.length > 0, true);
      assert.equal(typeof result.trima[0], 'number');
    });
  });

  describe('kama', () => {
    it('calculates Kaufman adaptive moving average', async () => {
      const result = await indicators.kama(closePrices, { key: 'kama', indicator: 'kama', options: { length: 9 } });
      assert.equal(result.kama.length > 0, true);
      assert.equal(typeof result.kama[0], 'number');
    });
  });

  describe('vwma', () => {
    it('calculates volume weighted moving average from candles', async () => {
      const result = await indicators.vwma(candlesAsc, { key: 'vwma', indicator: 'vwma', options: { length: 20 } });
      assert.equal(result.vwma.length > 0, true);
      assert.equal(result.vwma[0]! > 0, true, 'VWMA should be positive');
    });
  });

  describe('roc', () => {
    it('calculates rate of change', async () => {
      const result = await indicators.roc(closePrices, { key: 'roc', indicator: 'roc', options: { length: 14 } });
      assert.equal(result.roc.length > 0, true);
      assert.equal(typeof result.roc[0], 'number');
    });
  });

  describe('mfi', () => {
    it('calculates money flow index from candles', async () => {
      const result = await indicators.mfi(candlesAsc, { key: 'mfi', indicator: 'mfi', options: { length: 14 } });
      assert.equal(result.mfi.length > 0, true);
      assert.equal(typeof result.mfi[0], 'number');
      // MFI should be between 0 and 100
      assert.equal(result.mfi[0]! >= 0 && result.mfi[0]! <= 100, true);
    });
  });

  describe('adx', () => {
    it('calculates average directional index from candles', async () => {
      const result = await indicators.adx(candlesAsc, { key: 'adx', indicator: 'adx', options: { length: 14 } });
      assert.equal(result.adx.length > 0, true);
      assert.equal(result.adx[0]! > 0, true, 'ADX should be positive');
      // ADX should be between 0 and 100
      assert.equal(result.adx[0]! <= 100, true);
    });
  });

  describe('cci', () => {
    it('calculates commodity channel index from candles', async () => {
      const result = await indicators.cci(candlesAsc, { key: 'cci', indicator: 'cci', options: { length: 20 } });
      assert.equal(result.cci.length > 0, true);
      assert.equal(typeof result.cci[0], 'number');
    });
  });

  describe('obv', () => {
    it('calculates on balance volume from candles', async () => {
      const result = await indicators.obv(candlesAsc, { key: 'obv', indicator: 'obv' });
      assert.equal(result.obv.length > 0, true);
      assert.equal(typeof result.obv[0], 'number');
    });
  });

  describe('ao', () => {
    it('calculates awesome oscillator from candles', async () => {
      const result = await indicators.ao(candlesAsc, { key: 'ao', indicator: 'ao' });
      assert.equal(result.ao.length > 0, true);
      assert.equal(typeof result.ao[0], 'number');
    });
  });

  // talib-based indicators
  describe('macd_ext', () => {
    it('calculates extended MACD with different MA types', async () => {
      const result = await indicators.macd_ext(closePrices, {
        key: 'macd_ext',
        indicator: 'macd_ext',
        options: { fast_period: 12, slow_period: 26, signal_period: 9 }
      });
      assert.equal(result.macd_ext.length > 0, true);

      const firstResult = result.macd_ext[0] as any;
      assert.equal('macd' in firstResult, true);
      assert.equal('signal' in firstResult, true);
      assert.equal('histogram' in firstResult, true);
    });
  });

  describe('bb_talib', () => {
    it('calculates bollinger bands using talib', async () => {
      const result = await indicators.bb_talib(closePrices, {
        key: 'bb_talib',
        indicator: 'bb_talib',
        options: { length: 20, stddev: 2 }
      });
      assert.equal(result.bb_talib.length > 0, true);

      const firstResult = result.bb_talib[0] as any;
      assert.equal('upper' in firstResult, true);
      assert.equal('middle' in firstResult, true);
      assert.equal('lower' in firstResult, true);
      assert.equal('width' in firstResult, true);
    });
  });

  // technicalindicators-based
  describe('stoch_rsi', () => {
    it('calculates stochastic RSI', async () => {
      const result = await indicators.stoch_rsi(closePrices, {
        key: 'stoch_rsi',
        indicator: 'stoch_rsi',
        options: { rsi_length: 14, stoch_length: 14, k: 3, d: 3 }
      });
      assert.equal(result.stoch_rsi.length > 0, true);

      const fifthResult = result.stoch_rsi[5] as any;
      assert.equal('stoch_k' in fifthResult, true);
      assert.equal('stoch_d' in fifthResult, true);
    });
  });

  describe('psar', () => {
    it('calculates parabolic SAR from candles', async () => {
      const result = await indicators.psar(candlesAsc, {
        key: 'psar',
        indicator: 'psar',
        options: { step: 0.02, max: 0.2 }
      });
      assert.equal(result.psar.length > 0, true);
      assert.equal(typeof result.psar[0], 'number');
    });
  });

  describe('heikin_ashi', () => {
    it('calculates heikin ashi candles', async () => {
      const result = await indicators.heikin_ashi(candlesAsc, { key: 'heikin_ashi', indicator: 'heikin_ashi' });
      assert.equal(result.heikin_ashi.length, candlesAsc.length, 'Should return same number of candles');

      const firstCandle = result.heikin_ashi[0] as Candlestick;
      assert.equal('open' in firstCandle, true);
      assert.equal('high' in firstCandle, true);
      assert.equal('low' in firstCandle, true);
      assert.equal('close' in firstCandle, true);
    });
  });

  describe('candles', () => {
    it('returns candles unchanged', async () => {
      const result = await indicators.candles(candlesAsc, { key: 'candles', indicator: 'candles' });
      assert.equal(result.candles.length, candlesAsc.length);
      assert.deepEqual(result.candles[0], candlesAsc[0]);
    });
  });
});
