import { Telegraf } from 'telegraf';
import type { Logger } from '../modules/services';

export interface TelegramConfig {
  chat_id: string | number;
}

export class Telegram {
  constructor(private telegraf: Telegraf, private config: TelegramConfig, private logger: Logger) {}

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
