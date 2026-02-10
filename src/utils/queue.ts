const Queue = require('queue-promise');

export class QueueManager {
  private queue: any;
  private queue2: any;
  private queue3: any;

  constructor() {
    this.queue = new Queue({
      concurrent: 1,
      interval: 1120,
      start: true
    });

    this.queue2 = new Queue({
      concurrent: 2,
      interval: 1120,
      start: true
    });

    this.queue3 = new Queue({
      concurrent: 2,
      interval: 1180,
      start: true
    });
  }

  add(promise: () => Promise<any>): any {
    return this.queue.enqueue(promise);
  }

  addQueue2(promise: () => Promise<any>): any {
    return this.queue2.enqueue(promise);
  }

  addQueue3(promise: () => Promise<any>): any {
    return this.queue3.enqueue(promise);
  }
}

export default QueueManager;
