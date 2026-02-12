export interface Logger {
  debug(message: string): void;
  error(message: string): void;
}

export class Throttler {
  private logger: Logger;
  private readonly tasks: Record<string, NodeJS.Timeout>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.tasks = {};
  }

  addTask(key: string, func: () => Promise<void>, timeout: number = 1000): void {
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
}

export default Throttler;
