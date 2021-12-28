const services = require('../modules/services');

process.on('message', async msg => {
  const p = msg.pair.split('.');

  const results = await services
    .getBacktest()
    .getBacktestResult(
      msg.tickIntervalInMinutes,
      msg.hours,
      msg.strategy,
      msg.candlePeriod,
      p[0],
      p[1],
      msg.options,
      msg.initialCapital,
      msg.projectDir
    );

  process.send({
    results: results
  });
});
