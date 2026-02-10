import { SMA } from 'technicalindicators';

export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VolumePumpResult {
  volume_sd?: number;
  volume_v?: number;
  hint?: string;
  price_trigger?: number;
  roc_ma?: string;
}

/**
 * @param candles
 */
export function volumePump(candles: Candlestick[]): VolumePumpResult {
  if (candles.length < 20) {
    return {};
  }

  if (candles.length > 1 && candles[0].time > candles[1].time) {
    throw 'Invalid candlestick order';
  }

  const volSma = SMA.calculate({
    period: 20,
    values: candles.slice(-40).map(b => b.volume)
  });

  const candleSizeSma = SMA.calculate({
    period: 20,
    values: candles.slice(-40).map(v => Math.abs(v.open - v.close))
  });

  const currentCandle = candles.slice(-1)[0];
  const currentVolumeSma = volSma.slice(-1)[0];

  return {
    volume_sd: volSma.slice(-1)[0],
    volume_v: currentCandle.volume / currentVolumeSma > 5 ? currentCandle.volume / currentVolumeSma : undefined,
    hint: currentCandle.volume / currentVolumeSma > 5 ? 'success' : undefined,
    price_trigger: currentCandle.high,
    roc_ma:
      Math.abs(Math.abs(candles.slice(-1)[0].open - candles.slice(-1)[0].close)) / candleSizeSma.slice(-1)[0] > 4
        ? 'success'
        : undefined
  };
}
