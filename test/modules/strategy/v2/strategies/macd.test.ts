import assert from 'assert';
import fs from 'fs';
import * as path from 'path';
import { Macd } from '../../../../../src/strategy/strategies/macd';
import { StrategyExecutor } from '../../../../../src/modules/strategy/v2/typed_backtest';
import { Candlestick } from '../../../../../src/dict/candlestick';

interface RawCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

function createCandleFixtures(): RawCandle[] {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/btc-usdt-15m.json'), 'utf8'));
}

function toCandlestickInstances(candles: RawCandle[]): Candlestick[] {
  return candles.map(c => new Candlestick(c.time, c.open, c.high, c.low, c.close, c.volume));
}

function toAscOrder(candles: Candlestick[]): Candlestick[] {
  return candles.slice().reverse();
}

describe('#Macd', () => {
  let candlesDesc: Candlestick[];
  let candlesAsc: Candlestick[];
  let executor: StrategyExecutor;

  beforeEach(() => {
    const rawCandles = createCandleFixtures();
    candlesDesc = toCandlestickInstances(rawCandles);
    candlesAsc = toAscOrder(candlesDesc);
    executor = new StrategyExecutor();
  });

  describe('fixture validation', () => {
    it('fixture is DESC order (newest first)', () => {
      assert.equal(candlesDesc[0].time > candlesDesc[1].time, true);
    });

    it('ASC conversion works correctly', () => {
      assert.equal(candlesAsc[0].time < candlesAsc[1].time, true);
    });

    it('fixture has enough candles for indicator warmup', () => {
      assert.equal(candlesAsc.length >= 100, true, 'Should have at least 100 candles');
    });
  });

  describe('strategy initialization', () => {
    it('creates strategy with default options', () => {
      const strategy = new Macd();
      assert.equal(strategy.getDescription(), 'MACD histogram crossover with HMA/SMA200 trend filter');

      const options = strategy.getOptions();
      assert.equal(options.default_ma_type, 'EMA');
      assert.equal(options.fast_period, 12);
      assert.equal(options.slow_period, 26);
      assert.equal(options.signal_period, 9);
      assert.equal(options.hma_length, 9);
      assert.equal(options.sma_length, 200);
    });

    it('creates strategy with custom options', () => {
      const strategy = new Macd({ fast_period: 8, slow_period: 21 });

      const options = strategy.getOptions();
      assert.equal(options.fast_period, 8);
      assert.equal(options.slow_period, 21);
      assert.equal(options.signal_period, 9);
    });

    it('defines MACD, HMA and SMA200 indicators', () => {
      const strategy = new Macd();
      const indicators = strategy.defineIndicators();

      assert.equal('macd' in indicators, true);
      assert.equal('hma' in indicators, true);
      assert.equal('sma200' in indicators, true);
      assert.equal(indicators.macd.name, 'macd_ext');
      assert.equal(indicators.hma.name, 'hma');
      assert.equal(indicators.sma200.name, 'sma');
    });
  });

  describe('signal generation', () => {
    it('generates signals on fixture data', async () => {
      const strategy = new Macd();
      const results = await executor.execute(strategy, candlesAsc);

      const signals = results.filter(r => r.signal !== undefined);
      console.log(`    Generated ${signals.length} signals from ${results.length} candles`);

      for (const s of signals) {
        assert.equal(
          ['long', 'short', 'close'].includes(s.signal!),
          true,
          `Signal should be long, short, or close, got: ${s.signal}`
        );
      }

      // Verify debug info
      const entrySignals = signals.filter(s => s.signal === 'long' || s.signal === 'short');
      for (const s of entrySignals) {
        assert.equal('histogram' in s.debug, true, 'Should include histogram in debug');
        assert.equal('sma200' in s.debug, true, 'Should include SMA200 in debug');
        assert.equal('long' in s.debug, true, 'Should include trend in debug');
      }
    });

    it('generates expected signals on fixture data (snapshot test)', async () => {
      const strategy = new Macd();
      const results = await executor.execute(strategy, candlesAsc);

      const signals = results.filter(r => r.signal !== undefined);

      console.log('    Signals generated:');
      for (const s of signals.slice(0, 5)) {
        console.log(`      ${new Date(s.time * 1000).toISOString()} | Price: ${s.price} | Signal: ${s.signal} | Histogram: ${s.debug.histogram}`);
      }
      if (signals.length > 5) {
        console.log(`      ... and ${signals.length - 5} more signals`);
      }

      const signalRate = (signals.length / results.length) * 100;
      console.log(`    Signal rate: ${signalRate.toFixed(2)}% (${signals.length}/${results.length})`);
      assert.equal(signalRate < 20, true, `Signal rate should be reasonable (<20%), got ${signalRate.toFixed(2)}%`);
    });
  });

  describe('indicator warmup', () => {
    it('does not generate signals during warmup period', async () => {
      const strategy = new Macd();
      const results = await executor.execute(strategy, candlesAsc);

      const warmupSignals = results.slice(0, 30).filter(r => r.signal !== undefined);
      assert.equal(warmupSignals.length, 0, 'Should not generate signals during warmup period');
    });
  });

  describe('executor validation', () => {
    it('throws error when candles are in descending order', async () => {
      const strategy = new Macd();

      try {
        await executor.execute(strategy, candlesDesc);
        assert.fail('Should have thrown an error');
      } catch (error: any) {
        assert.equal(error.message.includes('ascending order'), true);
      }
    });
  });
});
