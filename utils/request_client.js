'use strict';

let request = require('request');

module.exports = class RequestClient {
    constructor(logger) {
        this.logger = logger
    }

    executeRequest(options) {
        return new Promise(resolve => {
            request(options, (error, response, body) => {
                resolve({
                    'error': error,
                    'response': response,
                    'body': body,
                })
            })
        })
    }

    executeRequestRetry(options, retryCallback, retryMs = 500, retries = 10) {
        let wait = (time) => {
            return new Promise(resolve => {
                setTimeout(() => {
                    resolve();
                }, time);
            });
        }

        return new Promise(async resolve => {
            let lastResult = undefined

            for (let retry = 0; retry < retries; retry++) {
                let result = lastResult = await this.executeRequest(options)

                let shouldRetry = retryCallback(result)

                if (shouldRetry !== true) {
                    resolve(result)
                    return
                }

                if (this.logger) {
                    this.logger.error('Request: error retry in ' + retryMs + 'ms')
                }

                await wait(retryMs);
            }

            resolve(lastResult)
        })
    }
}
