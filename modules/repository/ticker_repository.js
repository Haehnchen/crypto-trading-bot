module.exports = class TickerRepository {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  insertTickers(tickers) {
    return new Promise(resolve => {
      const upsert = this.db.prepare(
        'INSERT INTO ticker(exchange, symbol, ask, bid, updated_at) VALUES ($exchange, $symbol, $ask, $bid, $updated_at) ' +
          'ON CONFLICT(exchange, symbol) DO UPDATE SET ask=$ask, bid=$bid, updated_at=$updated_at'
      );

      this.db.transaction(() => {
        tickers.forEach(ticker => {
          const parameters = {
            exchange: ticker.exchange,
            symbol: ticker.symbol,
            ask: ticker.ask,
            bid: ticker.bid,
            updated_at: new Date().getTime()
          };

          upsert.run(parameters);
        });
      })();

      resolve();
    });
  }
};
