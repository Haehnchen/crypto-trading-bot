const promiseRetry = require('promise-retry');

module.exports = class Telegram {
  constructor(telegraf, config, logger) {
    this.telegraf = telegraf;
    this.config = config;
    this.logger = logger;
  }

  send(message) {
    const chatId = this.config.chat_id;
    if (!chatId) {
      console.log('Telegram: No chat id given');
      this.logger.error('Telegram: No chat id given');
      return;
    }

    const me = this;

    promiseRetry(
      function(retry, number) {
        return me.telegraf.telegram.sendMessage(chatId, message).catch(function(err) {
          if (err.code === 429) {
            retry(err);
          }

          throw err;
        });
      },
      {
        minTimeout: 3000
      }
    ).then(
      function() {},
      function(err) {
        me.logger.error(`Mailer: ${JSON.stringify(err)}`);
        console.log(err);
      }
    );
  }
};
