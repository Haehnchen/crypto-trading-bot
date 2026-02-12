export interface Notifier {
  send(message: string): void;
}

export class Notify {
  constructor(private notifier: Notifier[]) {}

  send(message: string): void {
    this.notifier.forEach(notify => notify.send(message));
  }
}
