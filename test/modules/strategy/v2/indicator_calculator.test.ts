import assert from 'assert';
import fs from 'fs';
import * as path from 'path';

/**
 * Direct test of indicator calculator functions
 * Tests that all indicator arrays are padded with nulls to match candle count
 */

// Import the module under test
const getTalib = () => require('talib');
const getTechnicalIndicators = () => require('technicalindicators');

// Import v2 indicator calculator
import { calculateIndicators } from '../../../../src/modules/strategy/v2/indicator_calculator';

/**
 * Test fixture: BTC/USD 5m candles
 */
function createCandleFixtures(): any[] {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../utils/fixtures/xbt-usd-5m.json'), 'utf8'));
  // Reverse to ASC order (oldest first) as expected by indicators
  return data.slice().reverse();
}

/**
 * Calculate BB (padded version - what we expect)
 */
function calculateBollingerBandsPadded(prices: number[], period: number, stddev: number): any[] {
  const talib = getTalib();
  const result = talib.execute({
    name: 'BBANDS',
    startIdx: 0,
    endIdx: prices.length - 1,
    inReal: prices,
    optInTimePeriod: period,
    optInNbDevUp: stddev,
    optInNbDevDn: stddev,
    optInMAType: 0
  });

  // Pad with nulls at the beginning to maintain candle alignment
  const results: any[] = new Array(prices.length).fill(null);
  for (let i = 0; i < result.nbElement; i++) {
    results[result.begIndex + i] = {
      upper: result.result.outRealUpperBand[i],
      middle: result.result.outRealMiddleBand[i],
      lower: result.result.outRealLowerBand[i],
      width: (result.result.outRealUpperBand[i] - result.result.outRealLowerBand[i]) / result.result.outRealMiddleBand[i]
    };
  }
  return results;
}

/**
 * Calculate SMA (padded version)
 */
function calculateSmaPadded(prices: number[], period: number): (number | null)[] {
  const talib = getTalib();
  const result = talib.execute({
    name: 'SMA',
    startIdx: 0,
    endIdx: prices.length - 1,
    inReal: prices,
    optInTimePeriod: period
  });

  const output: (number | null)[] = new Array(prices.length).fill(null);
  for (let i = 0; i < result.nbElement; i++) {
    output[result.begIndex + i] = result.result.outReal[i];
  }
  return output;
}

/**
 * Calculate HMA (padded version)
 */
function calculateHmaPadded(prices: number[], period: number): (number | null)[] {
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));

  // Calculate WMA helper - returns shorter array (length - period + 1)
  const wma = (data: number[], p: number): { result: number[], startIndex: number } => {
    const result: number[] = [];
    for (let i = p - 1; i < data.length; i++) {
      let sum = 0, weightSum = 0;
      for (let j = 0; j < p; j++) {
        sum += data[i - p + 1 + j] * (j + 1);
        weightSum += j + 1;
      }
      result.push(sum / weightSum);
    }
    return { result, startIndex: p - 1 };
  };

  const wmaHalf = wma(prices, halfPeriod);
  const wmaFull = wma(prices, period);

  const offset = period - halfPeriod;
  const rawData: number[] = [];
  for (let i = 0; i < wmaFull.result.length; i++) {
    rawData.push(2 * wmaHalf.result[i + offset] - wmaFull.result[i]);
  }

  // Final WMA on raw data
  const finalWma = wma(rawData, sqrtPeriod);

  // Calculate total offset from original prices array
  const totalOffset = wmaFull.startIndex + finalWma.startIndex;

  // Pad with nulls at the beginning to maintain candle alignment
  const output: (number | null)[] = new Array(prices.length).fill(null);
  for (let i = 0; i < finalWma.result.length; i++) {
    output[totalOffset + i] = finalWma.result[i];
  }
  return output;
}

describe('#indicator_calculator_v2 - alignment', () => {
  let candlesAsc: any[];
  let closePrices: number[];

  beforeEach(() => {
    candlesAsc = createCandleFixtures();
    closePrices = candlesAsc.map((c: any) => c.close);
  });

  describe('indicator-candle alignment', () => {
    it('BB returns array with same length as candles (padded with nulls)', () => {
      const results = calculateBollingerBandsPadded(closePrices, 20, 2);

      assert.equal(results.length, closePrices.length, 'BB array should match candle count');
      assert.equal(results[0], null, 'First BB values should be null (warmup)');
      assert.notEqual(results[results.length - 1], null, 'Last BB value should not be null');
    });

    it('SMA returns array with same length as candles (padded with nulls)', () => {
      const results = calculateSmaPadded(closePrices, 14);

      assert.equal(results.length, closePrices.length, 'SMA array should match candle count');
      // First 13 values should be null for SMA 14
      assert.equal(results[12], null, 'SMA[12] should be null');
      assert.notEqual(results[13], null, 'SMA[13] should have value');
    });

    it('HMA returns array with same length as candles (padded with nulls)', () => {
      const results = calculateHmaPadded(closePrices, 9);

      assert.equal(results.length, closePrices.length, 'HMA array should match candle count');
      assert.equal(results[0], null, 'First HMA values should be null (warmup)');
      assert.notEqual(results[results.length - 1], null, 'Last HMA value should not be null');
    });

    it('BB first valid index aligns with correct candle', () => {
      const period = 20;
      const results = calculateBollingerBandsPadded(closePrices, period, 2);

      // Find first non-null index
      let firstValidIndex = -1;
      for (let i = 0; i < results.length; i++) {
        if (results[i] !== null) {
          firstValidIndex = i;
          break;
        }
      }

      // For BB with period 20, first valid value should be at index 19 (begIndex from talib)
      assert.equal(firstValidIndex, period - 1, `First valid BB should be at index ${period - 1}`);
    });

    it('HMA first valid index is after warmup period', () => {
      const period = 9;
      const results = calculateHmaPadded(closePrices, period);

      // Find first non-null index
      let firstValidIndex = -1;
      for (let i = 0; i < results.length; i++) {
        if (results[i] !== null) {
          firstValidIndex = i;
          break;
        }
      }

      // HMA needs: period candles for first WMA + sqrt(period) for final WMA
      // So first valid should be around period-1 + sqrt(period)-1
      assert.ok(firstValidIndex > 0, 'HMA should have null warmup values');
      assert.ok(firstValidIndex < period + Math.sqrt(period), 'HMA warmup should be reasonable');
    });
  });

  describe('indicator values are correct', () => {
    it('BB last value is close to last candle price', () => {
      const results = calculateBollingerBandsPadded(closePrices, 20, 2);

      const lastBb = results[results.length - 1] as any;
      const lastClose = closePrices[closePrices.length - 1];

      assert.notEqual(lastBb, null, 'Last BB should not be null');
      assert.equal(typeof lastBb.lower, 'number', 'BB lower should be number');
      assert.equal(typeof lastBb.middle, 'number', 'BB middle should be number');
      assert.equal(typeof lastBb.upper, 'number', 'BB upper should be number');
      // Middle should be close to average of recent prices
      assert.ok(lastBb.lower < lastBb.middle, 'BB lower < middle');
      assert.ok(lastBb.middle < lastBb.upper, 'BB middle < upper');
      // Last close should be within or near the bands
      assert.ok(lastClose >= lastBb.lower * 0.9, 'Last close should be near or above lower band');
      assert.ok(lastClose <= lastBb.upper * 1.1, 'Last close should be near or below upper band');
    });

    it('HMA last value is positive for price data', () => {
      const results = calculateHmaPadded(closePrices, 9);

      const lastHma = results[results.length - 1];
      assert.notEqual(lastHma, null, 'Last HMA should not be null');
      assert.ok(lastHma! > 0, 'HMA should be positive for price data');
    });

    it('SMA first value is average of first N prices', () => {
      const period = 14;
      const results = calculateSmaPadded(closePrices, period);

      const firstSma = results[period - 1];
      assert.notEqual(firstSma, null, `SMA[${period - 1}] should not be null`);

      // Calculate expected SMA manually
      let sum = 0;
      for (let i = 0; i < period; i++) {
        sum += closePrices[i];
      }
      const expectedSma = sum / period;

      assert.ok(Math.abs(firstSma! - expectedSma) < 0.01, `SMA should match manual calculation: ${firstSma} vs ${expectedSma}`);
    });
  });
});

/**
 * Create Candlestick instances from raw fixture data
 */
function createCandlestickInstances(): any[] {
  const { Candlestick } = require('../../../../src/dict/candlestick');
  const raw = createCandleFixtures();
  return raw.map((c: any) => new Candlestick(c.time, c.open, c.high, c.low, c.close, c.volume));
}

describe('#indicator_calculator_v2 - calculateIndicators()', () => {
  let candles: any[];

  /** Extract a single indicator's values from the combined result */
  const pluck = (result: any[], key: string) => result.map((r: any) => r.indicators[key]);

  beforeEach(() => {
    candles = createCandlestickInstances();
  });

  it('returns same length as input candles', async () => {
    const definitions = {
      sma: { name: 'sma' as const, period: '5m' as const, options: { length: 14 }, key: 'sma' }
    };

    const result = await calculateIndicators(candles, definitions);
    assert.equal(result.length, candles.length, 'Result array should match candle count');
  });

  it('pairs each candle with its indicator values', async () => {
    const definitions = {
      sma: { name: 'sma' as const, period: '5m' as const, options: { length: 14 }, key: 'sma' }
    };

    const result = await calculateIndicators(candles, definitions);

    // Each entry has the original candle
    assert.equal(result[0].candle.time, candles[0].time);
    assert.equal(result[result.length - 1].candle.time, candles[candles.length - 1].time);
  });

  it('calculates SMA with correct alignment', async () => {
    const definitions = {
      sma: { name: 'sma' as const, period: '5m' as const, options: { length: 14 }, key: 'sma' }
    };

    const result = await calculateIndicators(candles, definitions);
    const sma = pluck(result, 'sma');

    assert.equal(sma[12], null, 'SMA[12] should be null (warmup)');
    assert.notEqual(sma[13], null, 'SMA[13] should have value');
    assert.equal(typeof sma[13], 'number', 'SMA values should be numbers');
  });

  it('calculates BB with correct structure', async () => {
    const definitions = {
      bb: { name: 'bb' as const, period: '5m' as const, options: { length: 20, stddev: 2 }, key: 'bb' }
    };

    const result = await calculateIndicators(candles, definitions);
    const bb = pluck(result, 'bb');

    assert.equal(bb[0], null, 'First BB should be null (warmup)');

    const lastBb = bb[bb.length - 1] as any;
    assert.notEqual(lastBb, null, 'Last BB should have value');
    assert.ok(lastBb.lower < lastBb.middle, 'BB lower < middle');
    assert.ok(lastBb.middle < lastBb.upper, 'BB middle < upper');
    assert.equal(typeof lastBb.width, 'number', 'BB should have width');
  });

  it('calculates RSI with values between 0 and 100', async () => {
    const definitions = {
      rsi: { name: 'rsi' as const, period: '5m' as const, options: { length: 14 }, key: 'rsi' }
    };

    const result = await calculateIndicators(candles, definitions);
    const rsi = pluck(result, 'rsi');

    const validValues = rsi.filter((v: any) => v !== null) as number[];
    assert.ok(validValues.length > 0, 'Should have valid RSI values');
    validValues.forEach(v => {
      assert.ok(v >= 0 && v <= 100, `RSI value ${v} should be between 0 and 100`);
    });
  });

  it('calculates MACD with correct structure', async () => {
    const definitions = {
      macd: { name: 'macd' as const, period: '5m' as const, options: { fast_length: 12, slow_length: 26, signal_length: 9 }, key: 'macd' }
    };

    const result = await calculateIndicators(candles, definitions);
    const macd = pluck(result, 'macd');

    const lastMacd = macd[macd.length - 1] as any;
    assert.notEqual(lastMacd, null, 'Last MACD should have value');
    assert.equal(typeof lastMacd.macd, 'number', 'MACD should have macd field');
    assert.equal(typeof lastMacd.signal, 'number', 'MACD should have signal field');
    assert.equal(typeof lastMacd.histogram, 'number', 'MACD should have histogram field');
  });

  it('calculates HMA with correct alignment', async () => {
    const definitions = {
      hma: { name: 'hma' as const, period: '5m' as const, options: { length: 9 }, key: 'hma' }
    };

    const result = await calculateIndicators(candles, definitions);
    const hma = pluck(result, 'hma');

    assert.equal(hma[0], null, 'First HMA should be null (warmup)');

    const lastHma = hma[hma.length - 1];
    assert.notEqual(lastHma, null, 'Last HMA should have value');
    assert.ok((lastHma as number) > 0, 'HMA should be positive for price data');
  });

  it('calculates multiple indicators at once', async () => {
    const definitions = {
      sma: { name: 'sma' as const, period: '5m' as const, options: { length: 14 }, key: 'sma' },
      rsi: { name: 'rsi' as const, period: '5m' as const, options: { length: 14 }, key: 'rsi' },
      bb: { name: 'bb' as const, period: '5m' as const, options: { length: 20, stddev: 2 }, key: 'bb' }
    };

    const result = await calculateIndicators(candles, definitions);

    assert.equal(result.length, candles.length);

    // Each entry has all indicator keys
    const last = result[result.length - 1].indicators;
    assert.ok('sma' in last, 'Should have SMA');
    assert.ok('rsi' in last, 'Should have RSI');
    assert.ok('bb' in last, 'Should have BB');
  });

  it('throws on unknown indicator', async () => {
    const definitions = {
      unknown: { name: 'nonexistent' as any, period: '5m' as const, options: {}, key: 'unknown' }
    };

    await assert.rejects(
      () => calculateIndicators(candles, definitions),
      /Unknown indicator/
    );
  });

  it('throws on descending candle order', async () => {
    const reversed = candles.slice().reverse();

    await assert.rejects(
      () => calculateIndicators(reversed, {
        sma: { name: 'sma' as const, period: '5m' as const, options: { length: 14 }, key: 'sma' }
      }),
      /ascending order/
    );
  });
});
