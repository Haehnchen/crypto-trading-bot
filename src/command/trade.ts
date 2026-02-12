import services from '../modules/services';

export class TradeCommand {
  constructor(_instance: string) {}

  execute(): void {
    services.createTradeInstance().start();
    services.createWebserverInstance().start();
  }
}
