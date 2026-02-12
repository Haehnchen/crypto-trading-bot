import services from '../modules/services';

export class TradeCommand {
  constructor() {}

  execute(): void {
    services.createTradeInstance().start();
    services.createWebserverInstance().start();
  }
}
