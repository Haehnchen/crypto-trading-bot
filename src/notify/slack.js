const request = require('request');

module.exports = class Slack {
  constructor(config) {
    this.config = config;
  }

  send(message) {
    const postOptions = {
      uri: this.config.webhook,
      method: 'POST',
      headers: {
        'Content-type': 'application/json'
      },
      json: {
        text: message,
        username: this.config.username || 'crypto-bot',
        icon_emoji: this.config.icon_emoji || ':ghost:'
      }
    };
    request(postOptions, (error, response, body) => {
      if (error) {
        console.log(error);
      }
    });
  }
};
