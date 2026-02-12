import request from 'request';

export interface SlackConfig {
  webhook: string;
  username?: string;
  icon_emoji?: string;
}

export class Slack {
  private config: SlackConfig;

  constructor(config: SlackConfig) {
    this.config = config;
  }

  send(message: string): void {
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
    request(postOptions, (error: any, _response: any, _body: any) => {
      if (error) {
        console.log(error);
      }
    });
  }
}
