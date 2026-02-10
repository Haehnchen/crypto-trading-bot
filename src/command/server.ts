const services = require('../modules/services');

export class ServerCommand {
  constructor(instance: string) {}

  execute(): void {
    services.createWebserverInstance().start();
  }
}
