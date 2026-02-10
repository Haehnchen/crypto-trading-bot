const services = require('../modules/services');

export class TradeCommand {
  constructor(instance: string) {}

  execute(): void {
    services.createTradeInstance().start();
    services.createWebserverInstance().start();
  }
}
