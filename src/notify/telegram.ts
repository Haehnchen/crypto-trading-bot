import { Telegraf } from 'telegraf';

export interface TelegramConfig {
  chat_id: string | number;
}

export class Telegram {
  private telegraf: Telegraf;
  private config: TelegramConfig;
  private logger: any;

  constructor(telegraf: Telegraf, config: TelegramConfig, logger: any) {
    this.telegraf = telegraf;
    this.config = config;
    this.logger = logger;
  }

  send(message: string): void {
    const chatId = this.config.chat_id;
    if (!chatId) {
      console.log('Telegram: No chat id given');
      this.logger.error('Telegram: No chat id given');
      return;
    }
    this.telegraf.telegram.sendMessage(chatId, message).catch((err: any) => {
      this.logger.error(`Mailer: ${JSON.stringify(err)}`);
      console.log(err);
    });
  }
}
