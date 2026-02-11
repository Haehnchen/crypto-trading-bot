import services from '../modules/services';

export class BackfillCommand {
  constructor() {}

  async execute(exchangeName: string, symbol: string, period: string, date: string): Promise<void> {
    await services.getBackfill().backfill(exchangeName, symbol, period, parseInt(date, 10));
  }
}
