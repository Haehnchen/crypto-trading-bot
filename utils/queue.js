const Queue = require('queue-promise');

module.exports = class {
  constructor() {
    this.queue = new Queue({
      concurrent: 1,
      interval: 1120, // every seconds; include some random ms
      start: true
    });
  }

  add(promise) {
    return this.queue.enqueue(promise);
  }
};
