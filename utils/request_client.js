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

            for (let retry = 1; retry <= retries; retry++) {
                let result = lastResult = await this.executeRequest(options)

                let shouldRetry = retryCallback(result)

                if (shouldRetry !== true) {
                    resolve(result)
                    return
                }

                if (this.logger) {
                    let debug = JSON.stringify([
                        options.url ? options.url : '',
                        result && result.response && result.response.statusCode ? result.response.statusCode : '',
                        options.body ? options.body.substring(0, 50) : '',
                    ])

                    this.logger.error(`Request: error retry (${retry}) in ${retryMs}ms ${debug}`)
                }

                await wait(retryMs);
            }

            resolve(lastResult)
        })
    }
}
