/**
 * An dummy exchange
 */
export class Noop {
  constructor() {}

  start(_config: any, _symbols: any[]): void {}

  getName(): string {
    return 'noop';
  }
}

export default Noop;
