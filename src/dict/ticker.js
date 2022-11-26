module.exports = class Ticker {
  constructor(exchange, symbol, time, bid, ask) {
    if (bid <= 0 || ask <= 0 || time <= 0 || !exchange || !symbol) {
      throw new Error(`Invalid Ticker bid/ask/time ${exchange} ${symbol}`);
    }

    this.exchange = exchange;
    this.symbol = symbol;
    this.time = time;
    this.bid = bid;
    this.ask = ask;
    this.createdAt = new Date();
  }
};
