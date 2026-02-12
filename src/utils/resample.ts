export interface Candlestick {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ResampledCandlestick extends Candlestick {
  _time: Date;
  _candle_count: number;
  _candles: Candlestick[];
}

/**
 * Resample eg 5m candle sticks into 15m or other minutes
 */
export function resampleMinutes(lookbackNewestFirst: Candlestick[], minutes: number): ResampledCandlestick[] {
  if (lookbackNewestFirst.length === 0) {
    return [];
  }

  if (lookbackNewestFirst.length > 1 && lookbackNewestFirst[0].time < lookbackNewestFirst[1].time) {
    throw 'Invalid candle stick order';
  }

  // group candles by its higher resample time
  const resampleCandleGroup: Record<number, Candlestick[]> = [];

  const secs = minutes * 60;
  lookbackNewestFirst.forEach(candle => {
    const mod = candle.time % secs;

    const resampleCandleClose =
      mod === 0
        ? candle.time // we directly catch the window: eg full hour matched
        : candle.time - mod + secs; // we calculate the next full window in future where es candle is closing

    // store the candle inside the main candle close
    if (!resampleCandleGroup[resampleCandleClose]) {
      resampleCandleGroup[resampleCandleClose] = [];
    }

    resampleCandleGroup[resampleCandleClose].push(candle);
  });

  const merge: ResampledCandlestick[] = [];

  for (const candleCloseTime in resampleCandleGroup) {
    const candles = resampleCandleGroup[candleCloseTime];

    const x = { open: [] as number[], high: [] as number[], low: [] as number[], close: [] as number[], volume: [] as number[] };

    candles.forEach(candle => {
      x.open.push(candle.open);
      x.high.push(candle.high);
      x.low.push(candle.low);
      x.close.push(candle.close);
      x.volume.push(candle.volume);
    });

    const sortHighToLow = candles.slice().sort((a, b) => {
      return b.time - a.time;
    });

    merge.push({
      time: parseInt(candleCloseTime),
      open: sortHighToLow[sortHighToLow.length - 1].open,
      high: Math.max(...x.high),
      low: Math.min(...x.low),
      close: sortHighToLow[0].close,
      volume: x.volume.reduce((sum, a) => sum + Number(a), 0),
      _time: new Date(parseInt(candleCloseTime) * 1000),
      _candle_count: candles.length,
      _candles: sortHighToLow
    });
  }

  // sort items and remove oldest item which can be incomplete
  return merge.sort((a, b) => b.time - a.time).splice(0, merge.length - 1);
}

/**
 * Resample eg 5m candle sticks into 15m or other minutes
 *
 * @returns number
 */
export function convertPeriodToMinute(period: string): number {
  const unit = period.slice(-1).toLowerCase();

  switch (unit) {
    case 'm':
      return parseInt(period.substring(0, period.length - 1));
    case 'h':
      return parseInt(period.substring(0, period.length - 1)) * 60;
    case 'd':
      return parseInt(period.substring(0, period.length - 1)) * 60 * 24;
    case 'w':
      return parseInt(period.substring(0, period.length - 1)) * 60 * 24 * 7;
    case 'y':
      return parseInt(period.substring(0, period.length - 1)) * 60 * 24 * 7 * 356;
    default:
      throw `Unsupported period unit: ${period}`;
  }
}

export function convertMinuteToPeriod(period: number): string {
  if (period < 60) {
    return `${period}m`;
  }

  if (period >= 60) {
    return `${period / 60}h`;
  }

  throw `Unsupported period: ${period}`;
}
