const notifier = require('node-notifier');

module.exports = class Notifier {
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  send(message) {
    notifier.notify({
      title: this.config.username || 'crypto-bot',
      message,
      icon: this.config.icon_emoji || ':ghost:',
      sound: this.config.sound,
      wait: this.config
    });
  }
};
