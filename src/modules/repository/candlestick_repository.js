const Candlestick = require('../../dict/candlestick');

module.exports = class CandlestickRepository {
  constructor(db) {
    this.db = db;
  }

  getLookbacksForPair(exchange, symbol, period, limit = 750, olderThen = undefined) {
    return new Promise(resolve => {
      const olderThenFilter = olderThen ? ' AND time <= :time ' : '';

      const stmt = this.db.prepare(
        `SELECT * from candlesticks WHERE exchange = $exchange AND symbol = $symbol AND period = $period ${olderThenFilter} order by time DESC LIMIT $limit`
      );

      const parameters = {
        exchange: exchange,
        symbol: symbol,
        period: period,
        limit: limit
      };

      if (olderThen) {
        parameters.time = olderThen;
      }

      const result = stmt.all(parameters).map(row => {
        return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume);
      });

      resolve(result);
    });
  }

  getLookbacksSince(exchange, symbol, period, start) {
    return new Promise(resolve => {
      const stmt = this.db.prepare(
        'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? and time > ? order by time DESC'
      );

      const result = stmt.all([exchange, symbol, period, start]).map(row => {
        return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume);
      });

      resolve(result);
    });
  }

  getCandlesInWindow(exchange, symbol, period, start, end) {
    return new Promise(resolve => {
      const stmt = this.db.prepare(
        'SELECT * from candlesticks where exchange = ? AND symbol = ? and period = ? and time > ?  and time < ? order by time DESC LIMIT 1000'
      );

      const result = stmt
        .all([exchange, symbol, period, Math.round(start.getTime() / 1000), Math.round(end.getTime() / 1000)])
        .map(row => {
          return new Candlestick(row.time, row.open, row.high, row.low, row.close, row.volume);
        });

      resolve(result);
    });
  }

  getExchangePairs() {
    return new Promise(resolve => {
      const stmt = this.db.prepare(
        'select exchange, symbol from candlesticks WHERE period != "1m" AND time > ? group by exchange, symbol order by exchange, symbol'
      );

      // only fetch candles newer the 5 days
      const since = Math.round(new Date(new Date() - 1000 * 60 * 60 * 24 * 2).getTime() / 1000);

      resolve(stmt.all([since]));
    });
  }

  getCandlePeriods(exchange, symbol) {
    return new Promise(resolve => {
      const stmt = this.db.prepare(
        `SELECT period from candlesticks where exchange = ? AND symbol = ? AND time > ? group by period ORDER BY period`
      );

      // only fetch candles newer the 5 days
      const since = Math.round(new Date(new Date() - 1000 * 60 * 60 * 24 * 5).getTime() / 1000);

      resolve(stmt.all([exchange, symbol, since]).map(row => row.period));
    });
  }

  insertCandles(exchangeCandlesticks) {
    return new Promise(resolve => {
      const upsert = this.db.prepare(
        'INSERT INTO candlesticks(exchange, symbol, period, time, open, high, low, close, volume) VALUES ($exchange, $symbol, $period, $time, $open, $high, $low, $close, $volume) ' +
          'ON CONFLICT(exchange, symbol, period, time) DO UPDATE SET open=$open, high=$high, low=$low, close=$close, volume=$volume'
      );

      this.db.transaction(() => {
        exchangeCandlesticks.forEach(exchangeCandlestick => {
          const parameters = {
            exchange: exchangeCandlestick.exchange,
            symbol: exchangeCandlestick.symbol,
            period: exchangeCandlestick.period,
            time: exchangeCandlestick.time,
            open: exchangeCandlestick.open,
            high: exchangeCandlestick.high,
            low: exchangeCandlestick.low,
            close: exchangeCandlestick.close,
            volume: exchangeCandlestick.volume
          };

          upsert.run(parameters);
        });
      })();

      resolve();
    });
  }
};
