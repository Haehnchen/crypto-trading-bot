module.exports = class Notify {
  constructor(notifier) {
    this.notifier = notifier;
  }

  send(message) {
    this.notifier.forEach(notify => notify.send(message));
  }
};
