module.exports = class Throttler {
  constructor(logger) {
    this.logger = logger;
    this.tasks = {};
  }

  addTask(key, func, timeout = 1000) {
    if (!(func instanceof Promise)) {
      throw new Error(`Throttler no async / promise function given: ${key}`);
    }

    if (key in this.tasks) {
      this.logger.debug(`Throttler clear existing event: ${key} - ${timeout}ms`);

      clearTimeout(this.tasks[key]);
      delete this.tasks[key];
    }

    const me = this;
    this.tasks[key] = setTimeout(async () => {
      delete me.tasks[key];
      await Promise.resolve(func);
    }, timeout);
  }
};
