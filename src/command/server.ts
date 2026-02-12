import services from '../modules/services';

export class ServerCommand {
  constructor() {}

  execute(): void {
    services.createWebserverInstance().start();
  }
}
