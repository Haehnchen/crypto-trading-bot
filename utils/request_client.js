'use strict';

let request = require('request');

module.exports = class RequestClient {
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
}
