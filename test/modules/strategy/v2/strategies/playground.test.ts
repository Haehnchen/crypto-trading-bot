import assert from 'assert';
import fs from 'fs';
import * as path from 'path';
import { StrategyRegistry } from '../../../../../src/modules/strategy/v2/strategy_registry';
import { StrategyExecutor } from '../../../../../src/modules/strategy/v2/typed_backtest';
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

/**
 * Convert raw candle objects to Candlestick class instances
 */
function toCandlestickInstances(candles: RawCandle[]): Candlestick[] {
  return candles.map(c => new Candlestick(c.time, c.open, c.high, c.low, c.close, c.volume));
}

/**
 * Convert DESC candles to ASC order (oldest first)
 */
function toAscOrder(candles: Candlestick[]): Candlestick[] {
  return candles.slice().reverse();
}

describe('#Playground (Dynamic)', () => {
  let rawCandles: RawCandle[];
  let candlesDesc: Candlestick[];
  let candlesAsc: Candlestick[];
  let executor: StrategyExecutor;
  let registry: StrategyRegistry;

  beforeEach(() => {
    rawCandles = createCandleFixtures();
    candlesDesc = toCandlestickInstances(rawCandles);
    candlesAsc = toAscOrder(candlesDesc);
    executor = new StrategyExecutor();
    registry = new StrategyRegistry();
  });

  describe('dynamic loading', () => {
    it('validates strategy from var/strategies directory', () => {
      assert.equal(registry.isValidStrategy('playground'), true);
    });

    it('creates strategy instance via registry', () => {
      const instance = registry.createStrategy('playground', {});
      assert.equal(instance.getDescription(), 'Heikin Ashi trend change strategy with HMA filter - detects trend reversals using candle patterns');
    });

    it('creates strategy with custom options', () => {
      const instance = registry.createStrategy('playground', {
        hma_length: 200,
        ema_length: 5
      });

      const options = instance.getOptions();
      assert.equal(options.hma_length, 200);
      assert.equal(options.ema_length, 5);
    });

    it('discovers strategies from var/strategies via getAllStrategyInfo', () => {
      const freshRegistry = new StrategyRegistry();
      const strategies = freshRegistry.getAllStrategyInfo();

      // Should discover playground strategy
      const playground = strategies.find(s => s.name === 'playground');
      assert.equal(playground !== undefined, true, 'Should discover playground strategy');
      assert.equal(playground!.description.includes('Heikin Ashi'), true);
    });
  });

  describe('strategy initialization', () => {
    it('defines heikin_ashi, hma, and ema indicators', () => {
      const instance = registry.createStrategy('playground', {});
      const indicators = instance.defineIndicators();

      assert.equal('heikin_ashi' in indicators, true, 'Should define heikin_ashi indicator');
      assert.equal('hma' in indicators, true, 'Should define HMA indicator');
      assert.equal('ema' in indicators, true, 'Should define EMA indicator');
    });
  });

  describe('signal generation', () => {
    it('generates signals on fixture data', async () => {
      const instance = registry.createStrategy('playground', {});
      const results = await executor.execute(instance, candlesAsc);

      // Filter for signals
      const signals = results.filter(r => r.signal !== undefined);

      console.log(`    Generated ${signals.length} signals from ${results.length} candles`);

      // Verify signals are valid types
      const validSignals = ['long', 'short', 'close'];
      for (const s of signals) {
        assert.equal(
          validSignals.includes(s.signal!),
          true,
          `Signal should be one of ${validSignals.join(', ')}, got ${s.signal}`
        );
      }
    });

    it('includes debug info in results', async () => {
      const instance = registry.createStrategy('playground', {});
      const results = await executor.execute(instance, candlesAsc);

      // Get last result with debug info
      const withDebug = results.filter(r => Object.keys(r.debug).length > 0);
      assert.equal(withDebug.length > 0, true, 'Should have debug info');

      // Check required debug fields
      const lastWithDebug = withDebug[withDebug.length - 1];
      assert.equal('price' in lastWithDebug.debug, true, 'Should include price');
      assert.equal('hma' in lastWithDebug.debug, true, 'Should include HMA');
      assert.equal('trend_up' in lastWithDebug.debug, true, 'Should include trend_up');
      assert.equal('trend_down' in lastWithDebug.debug, true, 'Should include trend_down');
      assert.equal('long_bias' in lastWithDebug.debug, true, 'Should include long_bias');
    });

    it('does not generate signals during warmup period', async () => {
      const instance = registry.createStrategy('playground', {});
      const results = await executor.execute(instance, candlesAsc);

      // First 10 candles should not have signals (need at least 6 HA candles + HMA warmup)
      const warmupSignals = results.slice(0, 10).filter(r => r.signal !== undefined);

      assert.equal(
        warmupSignals.length,
        0,
        'Should not generate signals during warmup period'
      );
    });

    it('long signals only occur when longBias is true', async () => {
      const instance = registry.createStrategy('playground', {});
      const results = await executor.execute(instance, candlesAsc);

      const longSignals = results.filter(r => r.signal === 'long');

      for (const s of longSignals) {
        assert.equal(
          s.debug.long_bias,
          true,
          `Long signal at ${new Date(s.time * 1000).toISOString()} should have long_bias=true`
        );
      }
    });

    it('short signals only occur when longBias is false', async () => {
      const instance = registry.createStrategy('playground', {});
      const results = await executor.execute(instance, candlesAsc);

      const shortSignals = results.filter(r => r.signal === 'short');

      for (const s of shortSignals) {
        assert.equal(
          s.debug.long_bias,
          false,
          `Short signal at ${new Date(s.time * 1000).toISOString()} should have long_bias=false`
        );
      }
    });
  });

  describe('executor validation', () => {
    it('throws error when candles are in descending order', async () => {
      const instance = registry.createStrategy('playground', {});

      try {
        await executor.execute(instance, candlesDesc); // Wrong order!
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
