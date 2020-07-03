const Datatable = require('sequelize-datatables');

module.exports = class LogsHttp {
  constructor(logsRepository) {
    this.logsRepository = logsRepository;
  }

  async getLogsPageVariables() {
    return {
      levels: await this.logsRepository
        .findAll({
          attributes: ['level'],
          group: ['level'],
          raw: true
        })
        .map(row => row.level)
    };
  }

  async getLogsData(request) {
    return Datatable(this.logsRepository, request.body, undefined, { replaceRegexp: true });
  }
};
