import services from '../modules/services';

export class ServerCommand {
  constructor(_instance: string) {}

  execute(): void {
    services.createWebserverInstance().start();
  }
}
