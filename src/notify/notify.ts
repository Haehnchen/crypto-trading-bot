export interface Notifier {
  send(message: string): void;
}

export class Notify {
  private notifier: Notifier[];

  constructor(notifier: Notifier[]) {
    this.notifier = notifier;
  }

  send(message: string): void {
    this.notifier.forEach(notify => notify.send(message));
  }
}
