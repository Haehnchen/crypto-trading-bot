/**
 * Strategy Module - All strategy types and utilities in one object
 *
 * Usage:
 *   import strategy, { Period, TypedIndicatorDefinition, BollingerBandsResult } from './strategy';
 *
 *   class MyStrategy extends strategy.StrategyBase<...> {
 *     defineIndicators() {
 *       return {
 *         hma: strategy.indicator.hma({ length: 9 }),
 *         bb: strategy.indicator.bb({ length: 20 })
 *       };
 *     }
 *   }
 *
 * Note: Indicators do NOT store their period. The period is set at the data fetch level
 * (e.g., when fetching candles for backtest or live trading), not in the indicator definition.
 */

// ============== Types ==============

export type PositionSide = 'long' | 'short';

export type Period = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';

export interface BollingerBandsResult {
  upper: number;
  middle: number;
  lower: number;
  width: number;
}

export interface MacdResult {
  macd: number;
  signal: number;
  histogram: number;
}

export interface StochResult {
  stoch_k: number;
  stoch_d: number;
}

export interface StochRsiResult {
  stoch_k: number;
  stoch_d: number;
}

export interface HeikinAshiResult {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PivotPointResult {
  high?: { close?: number; high?: number; };
  low?: { close?: number; low?: number; };
}

export interface WickedResult { top: number; body: number; bottom: number; }
export interface ZigzagResult { timePeriod: number; value: number; deviation: number; turningPoint: boolean; }
export interface VolumeByPriceResult { low: number; high: number; volume: number; }
export interface IchimokuCloudResult { conversion: number; base: number; spanA: number; spanB: number; }

// Option types
export interface PeriodOptions { length?: number; }
export interface BollingerBandsOptions { length?: number; stddev?: number; }
export interface MacdOptions { fast_length?: number; slow_length?: number; signal_length?: number; }
export interface MacdExtOptions { fast_period?: number; slow_period?: number; signal_period?: number; default_ma_type?: string; fast_ma_type?: string; slow_ma_type?: string; signal_ma_type?: string; }
export interface StochOptions { length?: number; k?: number; d?: number; }
export interface StochRsiOptions { rsi_length?: number; stoch_length?: number; k?: number; d?: number; }
export interface HmaOptions { length?: number; source?: string; }
export interface PsarOptions { step?: number; max?: number; }
export interface PivotPointsOptions { left?: number; right?: number; }
export interface ZigzagOptions { length?: number; deviation?: number; }
export interface VolumeProfileOptions { length?: number; ranges?: number; }
export interface IchimokuCloudOptions { conversionPeriod?: number; basePeriod?: number; spanPeriod?: number; displacement?: number; }

// Indicator Registry
interface IndicatorRegistry {
  sma: { options: PeriodOptions; returns: number[] };
  ema: { options: PeriodOptions; returns: number[] };
  wma: { options: PeriodOptions; returns: number[] };
  dema: { options: PeriodOptions; returns: number[] };
  tema: { options: PeriodOptions; returns: number[] };
  trima: { options: PeriodOptions; returns: number[] };
  kama: { options: PeriodOptions; returns: number[] };
  bb: { options: BollingerBandsOptions; returns: BollingerBandsResult[] };
  bb_talib: { options: BollingerBandsOptions; returns: BollingerBandsResult[] };
  hma: { options: HmaOptions; returns: number[] };
  psar: { options: PsarOptions; returns: number[] };
  heikin_ashi: { options: {}; returns: HeikinAshiResult[] };
  macd: { options: MacdOptions; returns: MacdResult[] };
  macd_ext: { options: MacdExtOptions; returns: MacdResult[] };
  rsi: { options: PeriodOptions; returns: number[] };
  cci: { options: PeriodOptions; returns: number[] };
  mfi: { options: PeriodOptions; returns: number[] };
  stoch: { options: StochOptions; returns: StochResult[] };
  stoch_rsi: { options: StochRsiOptions; returns: StochRsiResult[] };
  roc: { options: PeriodOptions; returns: number[] };
  adx: { options: PeriodOptions; returns: number[] };
  obv: { options: {}; returns: number[] };
  vwma: { options: PeriodOptions; returns: number[] };
  volume_profile: { options: VolumeProfileOptions; returns: any[] };
  volume_by_price: { options: VolumeProfileOptions; returns: VolumeByPriceResult[][] };
  atr: { options: PeriodOptions; returns: number[] };
  ao: { options: {}; returns: number[] };
  pivot_points_high_low: { options: PivotPointsOptions; returns: PivotPointResult[] };
  zigzag: { options: ZigzagOptions; returns: ZigzagResult[] };
  wicked: { options: {}; returns: WickedResult[] };
  ichimoku_cloud: { options: IchimokuCloudOptions; returns: IchimokuCloudResult[] };
  candles: { options: {}; returns: any[] };
}

export type IndicatorName = keyof IndicatorRegistry;
type IndicatorOptions<K extends IndicatorName> = IndicatorRegistry[K]['options'];
export type IndicatorReturns<K extends IndicatorName> = IndicatorRegistry[K]['returns'];

export interface TypedIndicatorDefinition<K extends IndicatorName = IndicatorName> {
  readonly name: K;
  readonly options: IndicatorOptions<K>;
  readonly key: string;
}

export type InferIndicatorResult<T extends TypedIndicatorDefinition> = T extends TypedIndicatorDefinition<infer K> ? IndicatorReturns<K> : never;
export type IndicatorsResult<T extends Record<string, TypedIndicatorDefinition>> = { [K in keyof T]: InferIndicatorResult<T[K]> };
export type LatestIndicators<T extends Record<string, TypedIndicatorDefinition>> = { [K in keyof T]: InferIndicatorResult<T[K]> extends (infer V)[] ? V : InferIndicatorResult<T[K]> };

// Strategy types

// ============== Helper Functions ==============

function createIndicator<K extends IndicatorName>(name: K, options: IndicatorOptions<K> = {}): TypedIndicatorDefinition<K> {
  return { name, options, key: name } as TypedIndicatorDefinition<K>;
}

// ============== Classes ==============

export class TypedStrategyContext<TIndicators extends Record<string, TypedIndicatorDefinition>> {
  constructor(
    private readonly _price: number,
    private readonly _indicators: IndicatorsResult<TIndicators>,
    private readonly _lastSignal: 'long' | 'short' | 'close' | undefined,
    private readonly _prices: number[] = []
  ) {}

  get price(): number { return this._price; }
  get indicators(): IndicatorsResult<TIndicators> { return this._indicators; }
  get lastSignal(): 'long' | 'short' | 'close' | undefined { return this._lastSignal; }

  /** Accumulated close prices up to and including the current candle */
  get prices(): number[] { return this._prices; }

  /** Get the last N close prices (most recent last) */
  getLastPrices(count: number): number[] { return this._prices.slice(-count); }

  isLong(): boolean { return this._lastSignal === 'long'; }
  isShort(): boolean { return this._lastSignal === 'short'; }
  isFlat(): boolean { return this._lastSignal === undefined || this._lastSignal === 'close'; }

  getIndicator<K extends keyof TIndicators>(key: K): IndicatorsResult<TIndicators>[K] {
    return this._indicators[key];
  }

  getLatestIndicator<K extends keyof TIndicators>(key: K): LatestIndicators<TIndicators>[K] {
    const arr = this._indicators[key];
    if (Array.isArray(arr) && arr.length > 0) return arr[arr.length - 1] as LatestIndicators<TIndicators>[K];
    return arr as LatestIndicators<TIndicators>[K];
  }

  getIndicatorSlice<K extends keyof TIndicators>(key: K, count: number): IndicatorsResult<TIndicators>[K] {
    const arr = this._indicators[key];
    if (Array.isArray(arr)) return arr.slice(-count) as IndicatorsResult<TIndicators>[K];
    return arr;
  }
}

export class StrategySignal {
  private _signal: 'long' | 'short' | 'close' | undefined;
  private _debug: Record<string, any> = {};
  private _orders: Array<{ type: 'buy' | 'sell'; amount: number; price: number }> = [];

  goLong(): this { this._signal = 'long'; return this; }
  goShort(): this { this._signal = 'short'; return this; }
  close(): this { this._signal = 'close'; return this; }
  debugAll(values: Record<string, any>): this { Object.assign(this._debug, values); return this; }
  placeBuyOrder(amountCurrency: number, price: number): this { this._orders.push({ type: 'buy', amount: amountCurrency, price }); return this; }
  placeSellOrder(amountCurrency: number, price: number): this { this._orders.push({ type: 'sell', amount: amountCurrency, price }); return this; }

  get signal(): 'long' | 'short' | 'close' | undefined { return this._signal; }
  getDebug(): Record<string, any> { return { ...this._debug }; }
  hasSignal(): boolean { return this._signal !== undefined; }
}

export interface TypedStrategy<TIndicators extends { [key: string]: TypedIndicatorDefinition<any> }, TOptions extends Record<string, any> = Record<string, any>> {
  getDescription(): string;
  defineIndicators(): TIndicators;
  execute(context: TypedStrategyContext<TIndicators>, signal: StrategySignal): Promise<void>;
  getOptions?(): TOptions;
}

export abstract class StrategyBase<TIndicators extends { [key: string]: TypedIndicatorDefinition<any> }, TOptions extends Record<string, any> = Record<string, any>> implements TypedStrategy<TIndicators, TOptions> {
  protected options: TOptions;

  constructor(partialOptions?: Partial<TOptions>) {
    const defaults = (this as any).getDefaultOptions?.() ?? {} as TOptions;
    this.options = { ...defaults, ...partialOptions } as TOptions;
  }

  abstract getDescription(): string;
  abstract defineIndicators(): TIndicators;
  abstract execute(context: TypedStrategyContext<TIndicators>, signal: StrategySignal): Promise<void>;

  protected getDefaultOptions?(): TOptions;
  getOptions(): TOptions { return this.options; }
}

// ============== Strategy Module Object ==============

const strategy = {
  // Constants
  VALID_PERIODS: ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'] as const,

  // Classes
  StrategyBase,
  StrategySignal,
  TypedStrategyContext,

  // Indicator builders (period is set at fetch/calculation time, not stored in definition)
  indicator: {
    sma: (options: PeriodOptions = {}) => createIndicator('sma', options),
    ema: (options: PeriodOptions = {}) => createIndicator('ema', options),
    wma: (options: PeriodOptions = {}) => createIndicator('wma', options),
    dema: (options: PeriodOptions = {}) => createIndicator('dema', options),
    tema: (options: PeriodOptions = {}) => createIndicator('tema', options),
    trima: (options: PeriodOptions = {}) => createIndicator('trima', options),
    kama: (options: PeriodOptions = {}) => createIndicator('kama', options),
    hma: (options: HmaOptions = {}) => createIndicator('hma', options),
    bb: (options: BollingerBandsOptions = {}) => createIndicator('bb', options),
    bbTalib: (options: BollingerBandsOptions = {}) => createIndicator('bb_talib', options),
    psar: (options: PsarOptions = {}) => createIndicator('psar', options),
    heikinAshi: (options: {} = {}) => createIndicator('heikin_ashi', options),
    macd: (options: MacdOptions = {}) => createIndicator('macd', options),
    macdExt: (options: MacdExtOptions = {}) => createIndicator('macd_ext', options),
    rsi: (options: PeriodOptions = {}) => createIndicator('rsi', options),
    cci: (options: PeriodOptions = {}) => createIndicator('cci', options),
    mfi: (options: PeriodOptions = {}) => createIndicator('mfi', options),
    stoch: (options: StochOptions = {}) => createIndicator('stoch', options),
    stochRsi: (options: StochRsiOptions = {}) => createIndicator('stoch_rsi', options),
    roc: (options: PeriodOptions = {}) => createIndicator('roc', options),
    adx: (options: PeriodOptions = {}) => createIndicator('adx', options),
    obv: (options: {} = {}) => createIndicator('obv', options),
    vwma: (options: PeriodOptions = {}) => createIndicator('vwma', options),
    volumeProfile: (options: VolumeProfileOptions = {}) => createIndicator('volume_profile', options),
    volumeByPrice: (options: VolumeProfileOptions = {}) => createIndicator('volume_by_price', options),
    atr: (options: PeriodOptions = {}) => createIndicator('atr', options),
    ao: (options: {} = {}) => createIndicator('ao', options),
    pivotPointsHighLow: (options: PivotPointsOptions = {}) => createIndicator('pivot_points_high_low', options),
    zigzag: (options: ZigzagOptions = {}) => createIndicator('zigzag', options),
    wicked: (options: {} = {}) => createIndicator('wicked', options),
    ichimokuCloud: (options: IchimokuCloudOptions = {}) => createIndicator('ichimoku_cloud', options),
    candles: (options: {} = {}) => createIndicator('candles', options),
  },
};

export default strategy;
