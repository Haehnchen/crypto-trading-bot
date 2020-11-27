const Queue = require('queue-promise');

module.exports = class {
  constructor() {
    this.queue = new Queue({
      concurrent: 1,
      interval: 1120, // every seconds; include some random ms
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

  add(promise) {
    return this.queue.enqueue(promise);
  }

  addQueue2(promise) {
    return this.queue2.enqueue(promise);
  }

  addQueue3(promise) {
    return this.queue3.enqueue(promise);
  }
};
