'use strict';

let _ = require('lodash')

module.exports = class LogsHttp {
    constructor(logsRepository) {
        this.logsRepository = logsRepository
    }

    async getLogsPageVariables() {
        return {
            'logs': await this.logsRepository.getLatestLogs()
        }
    }
}
