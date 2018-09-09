'use strict';

module.exports = class Mail {
    constructor(mailer, logger) {
        this.mailer = mailer
        this.logger = logger

    }

    send(message){
        this.mailer.sendMail({
                to: "espendiller@gmx.de",
                subject: message,
                text: message
            }, (err) => {
                if(err){
                    this.logger.error('Mailer: ' + JSON.stringify(err))
                }
            });
    }
}
