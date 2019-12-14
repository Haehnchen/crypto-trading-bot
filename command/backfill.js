const services = require('../modules/services');

module.exports = class BackfillCommand {
  constructor() {}

  async execute(exchangeName, symbol, period, date) {
    await services.getBackfill().backfill(exchangeName, symbol, period, date);
  }
};
