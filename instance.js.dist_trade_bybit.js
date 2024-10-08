const c = (module.exports = {});

c.symbols = [];

c.init = async () => {
  const j = ['BTC/USDT:USDT', 'ETH/USDT:USDT', 'LTC/USDT:USDT', 'SOL/USDT:USDT', 'ETC/USDT:USDT', '1000PEPE/USDT:USDT', 'XRP/USDT:USDT'];

  j.forEach(pair => {
    c.symbols.push({
      symbol: pair,
      periods: ['1m', '15m', '1h'],
      exchange: 'bybit_unified',
      state: 'watch'
    });
  });
};
