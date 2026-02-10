/**
 * An dummy exchange
 */
export class Noop {
  constructor() {}

  start(config: any, symbols: any[]): void {}

  getName(): string {
    return 'noop';
  }
}

export default Noop;
