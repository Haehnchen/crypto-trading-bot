const _ = require('lodash');

module.exports = class LogsHttp {
  constructor(logsRepository) {
    this.logsRepository = logsRepository;
  }

  async getLogsPageVariables(request, response) {
    let excludeLevels = request.query.exclude_levels || [];

    if (excludeLevels.length === 0 && !('filters' in request.cookies)) {
      excludeLevels = ['debug'];
    }

    response.cookie('filters', excludeLevels, {
      maxAge: 60 * 60 * 24 * 30 * 1000
    });

    return {
      logs: await this.logsRepository.getLatestLogs(excludeLevels),
      levels: await this.logsRepository.getLevels(),
      form: {
        excludeLevels: excludeLevels
      }
    };
  }
};
