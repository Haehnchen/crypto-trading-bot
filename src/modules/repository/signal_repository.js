module.exports = class SignalRepository {
  constructor(db) {
    this.db = db;
  }

  getSignals(since) {
    return new Promise(resolve => {
      const stmt = this.db.prepare('SELECT * from signals where income_at > ? order by income_at DESC LIMIT 100');
      resolve(stmt.all(since));
    });
  }

  insertSignal(exchange, symbol, options, side, strategy) {
    const stmt = this.db.prepare(
      'INSERT INTO signals(exchange, symbol, options, side, strategy, income_at) VALUES ($exchange, $symbol, $options, $side, $strategy, $income_at)'
    );

    stmt.run({
      exchange: exchange,
      symbol: symbol,
      options: JSON.stringify(options || {}),
      side: side,
      strategy: strategy,
      income_at: Math.floor(Date.now() / 1000)
    });
  }
};
