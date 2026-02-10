export class PairInterval {
  private intervals: Record<string, NodeJS.Timeout>;

  constructor() {
    this.intervals = {};
  }

  /**
   * @param name {string}
   * @param func {Function}
   * @param delay {int}
   */
  addInterval(name: string, delay: number, func: () => void | Promise<void>): void {
    if (name in this.intervals) {
      clearInterval(this.intervals[name]);
    }

    setTimeout(func, 1);
    this.intervals[name] = setInterval(func, delay);
  }

  /**
   * @param name {string}
   */
  clearInterval(name: string): void {
    if (name in this.intervals) {
      clearInterval(this.intervals[name]);
      delete this.intervals[name];
    }
  }
}
