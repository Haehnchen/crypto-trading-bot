const c = (module.exports = {});

c.symbols = [];

c.init = async () => {
  const j = ['BTC/USDT:USDT', 'BTC/USDC:USDC'];

  j.forEach(pair => {
    c.symbols.push({
      symbol: pair,
      periods: ['1m', '15m', '1h'],
      exchange: 'bybit_unified',
      state: 'watch'
    });
  });
};
