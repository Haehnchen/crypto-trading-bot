import assert from 'assert';
import fs from 'fs';
import * as path from 'path';
import { DcaDipper } from '../../../../../src/strategy/strategies/dca_dipper/dca_dipper';
import { StrategyExecutor, type SignalRow } from '../../../../../src/modules/strategy/v2/typed_backtest';
import { Candlestick } from '../../../../../src/dict/candlestick';

/**
 * Raw candle data from fixture (plain objects)
 */
interface RawCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Test fixture: BTC/USDT 15m candles (DESC order - newest first)
 */
function createCandleFixtures(): RawCandle[] {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/btc-usdt-15m.json'), 'utf8'));
}

function toCandlestickInstances(candles: RawCandle[]): Candlestick[] {
  return candles.map(c => new Candlestick(c.time, c.open, c.high, c.low, c.close, c.volume));
}

function toAscOrder(candles: Candlestick[]): Candlestick[] {
  return candles.slice().reverse();
}

describe('#DcaDipper', () => {
  let rawCandles: RawCandle[];
  let candlesDesc: Candlestick[];
  let candlesAsc: Candlestick[];
  let executor: StrategyExecutor;

  beforeEach(() => {
    rawCandles = createCandleFixtures();
    candlesDesc = toCandlestickInstances(rawCandles);
    candlesAsc = toAscOrder(candlesDesc);
    executor = new StrategyExecutor();
  });

  describe('fixture validation', () => {
    it('fixture is DESC order (newest first)', () => {
      assert.equal(candlesDesc[0].time > candlesDesc[1].time, true, 'Fixture should be DESC order');
    });

    it('ASC conversion works correctly', () => {
      assert.equal(candlesAsc[0].time < candlesAsc[1].time, true, 'ASC order: oldest first');
    });

    it('fixture has enough candles for indicator warmup', () => {
      assert.equal(candlesAsc.length >= 100, true, 'Should have at least 100 candles for testing');
    });
  });

  describe('strategy initialization', () => {
    it('creates strategy with default options', () => {
      const strategy = new DcaDipper();
      assert.equal(strategy.getDescription(), 'Dollar Cost Averaging strategy - Buy when HMA crosses above Bollinger Band lower band');

      const options = strategy.getOptions();
      assert.equal(options.amount_currency, '12');
      assert.equal(options.hma_period, 9);
      assert.equal(options.bb_length, 20);
      assert.equal(options.bb_stddev, 2);
    });

    it('creates strategy with custom options', () => {
      const strategy = new DcaDipper({
        amount_currency: '50',
        hma_period: 14,
        bb_length: 30
      });

      const options = strategy.getOptions();
      assert.equal(options.amount_currency, '50');
      assert.equal(options.hma_period, 14);
      assert.equal(options.bb_length, 30);
    });

    it('defines HMA and BB indicators (period not stored in definition)', () => {
      const strategy = new DcaDipper();
      const indicators = strategy.defineIndicators();

      assert.equal('hma' in indicators, true, 'Should define HMA indicator');
      assert.equal('bb' in indicators, true, 'Should define BB indicator');
      assert.equal(indicators.hma.name, 'hma');
      assert.equal(indicators.bb.name, 'bb');
      assert.equal('period' in indicators.hma, false, 'Period should not be stored in indicator definition');
      assert.equal('period' in indicators.bb, false, 'Period should not be stored in indicator definition');
    });
  });

  describe('signal generation', () => {
    it('generates signals on fixture data', async () => {
      const strategy = new DcaDipper();
      const results = await executor.execute(strategy, candlesAsc);

      const signals = results.filter(r => r.signal !== undefined);

      console.log(`    Generated ${signals.length} signals from ${results.length} candles`);

      // Verify signals are 'long' only (DCA Dipper is buy-only)
      for (const s of signals) {
        assert.equal(s.signal, 'long', 'DCA Dipper should only generate long signals');
      }

      // Verify debug info is populated
      for (const s of signals) {
        assert.equal('hma' in s.debug, true, 'Should include HMA in debug');
        assert.equal('bb_lower' in s.debug, true, 'Should include BB lower in debug');
        assert.equal('buy' in s.debug, true, 'Should include buy flag in debug');
        assert.equal(s.debug.buy, true, 'buy flag should be true when signal is generated');
      }
    });

    it('signals occur when HMA crosses below BB lower band', async () => {
      const strategy = new DcaDipper();
      const results = await executor.execute(strategy, candlesAsc);

      const signals = results.filter(r => r.signal === 'long');

      for (const s of signals) {
        const { hma, hma_prev, bb_lower, bb_lower_prev } = s.debug;

        assert.equal(
          hma < bb_lower,
          true,
          `HMA (${hma}) should be below BB lower (${bb_lower}) at signal time ${new Date(s.time * 1000).toISOString()}`
        );

        assert.equal(
          hma_prev > bb_lower_prev,
          true,
          `Previous HMA (${hma_prev}) should be above previous BB lower (${bb_lower_prev}) for crossover`
        );
      }
    });

    it('generates expected signals on fixture data (snapshot test)', async () => {
      const strategy = new DcaDipper();
      const results = await executor.execute(strategy, candlesAsc);

      const signals = results
        .filter(r => r.signal === 'long')
        .map(s => ({
          time: s.time,
          price: s.price,
          hma: Math.round(s.debug.hma * 100) / 100,
          bb_lower: Math.round(s.debug.bb_lower * 100) / 100
        }));

      console.log('    Signals generated:');
      for (const s of signals.slice(0, 5)) {
        console.log(`      ${new Date(s.time * 1000).toISOString()} | Price: ${s.price} | HMA: ${s.hma} | BB Lower: ${s.bb_lower}`);
      }
      if (signals.length > 5) {
        console.log(`      ... and ${signals.length - 5} more signals`);
      }

      assert.equal(signals.length > 0, true, 'Expected at least one signal in the test data');

      const signalRate = (signals.length / results.length) * 100;
      console.log(`    Signal rate: ${signalRate.toFixed(2)}% (${signals.length}/${results.length})`);
      assert.equal(signalRate < 10, true, `Signal rate should be reasonable (<10%), got ${signalRate.toFixed(2)}%`);
    });
  });

  describe('indicator warmup', () => {
    it('does not generate signals during warmup period', async () => {
      const strategy = new DcaDipper();
      const results = await executor.execute(strategy, candlesAsc);

      const warmupSignals = results.slice(0, 30).filter(r => r.signal !== undefined);

      assert.equal(warmupSignals.length, 0, 'Should not generate signals during warmup period');
    });
  });

  describe('executor validation', () => {
    it('throws error when candles are in descending order', async () => {
      const strategy = new DcaDipper();

      try {
        await executor.execute(strategy, candlesDesc);
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.equal(
          error.message.includes('ascending order'),
          true,
          'Error should mention ascending order requirement'
        );
      }
    });
  });
});
