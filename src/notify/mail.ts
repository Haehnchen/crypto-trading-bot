export class Mail {
  private mailer: any;
  private systemUtil: any;
  private logger: any;

  constructor(mailer: any, systemUtil: any, logger: any) {
    this.mailer = mailer;
    this.systemUtil = systemUtil;
    this.logger = logger;
  }

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
