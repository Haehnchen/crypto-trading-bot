import type { Logger } from '../modules/services';
import type { SystemUtil } from '../modules/system/system_util';

export class Mail {
  constructor(private mailer: any, private systemUtil: SystemUtil, private logger: Logger) {}

  send(message: string): void {
    const to = this.systemUtil.getConfig('notify.mail.to');
    if (!to) {
      this.logger.error('No mail "to" address given');

      return;
    }

    this.mailer.sendMail(
      {
        to: to,
        subject: message,
        text: message
      },
      (err: any) => {
        if (err) {
          this.logger.error(`Mailer: ${JSON.stringify(err)}`);
        }
      }
    );
  }
}
