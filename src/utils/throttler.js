module.exports = class Throttler {
  constructor(logger) {
    this.logger = logger;
    this.tasks = {};
  }

  addTask(key, func, timeout = 1000) {
    if (func.constructor.name !== 'AsyncFunction') {
      throw new Error(`Throttler no async function given: ${key}`);
    }

    if (key in this.tasks) {
      this.logger.debug(`Throttler already existing task: ${key} - ${timeout}ms`);
      return;
    }

    const me = this;
    this.tasks[key] = setTimeout(async () => {
      delete me.tasks[key];
      try {
        await func();
      } catch (e) {
        me.logger.error(`Task error: ${key} - ${String(e)}`);
      }
    }, timeout);
  }
};
