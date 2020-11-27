module.exports = class PairInterval {
  constructor() {
    this.intervals = {};
  }

  /**
   * @param name {string}
   * @param func {Function}
   * @param delay {int}
   */
  addInterval(name, delay, func) {
    if (name in this.intervals) {
      clearInterval(this.intervals[name]);
    }

    setTimeout(func, 1);
    this.intervals[name] = setInterval(func, delay);
  }

  /**
   * @param name {string}
   */
  clearInterval(name) {
    if (name in this.intervals) {
      clearInterval(this.intervals[name]);
      delete this.intervals[name];
    }
  }
};
