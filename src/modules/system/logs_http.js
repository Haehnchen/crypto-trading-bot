module.exports = class LogsHttp {
  constructor(logsRepository) {
    this.logsRepository = logsRepository;
  }

  async getLogsPageVariables(request, response) {
    const filters = request.query.filters ||
      request.cookies.filters || { logExcludeLevels: ['debug'], logTxtFilter: '' };

    response.cookie('filters', filters, {
      maxAge: 60 * 60 * 24 * 30 * 1000
    });

    // We will highlight profit number in logs output
    const logs = await this.logsRepository.getLatestLogs(filters);
    logs.forEach(log => {
      const profit = log.message.match(/(?<=profit":)(-?\d+.\d+)/);
      if (profit) {
        [ log.profit ] = profit;
      }
    });

    return {
      logs: logs,
      levels: await this.logsRepository.getLevels(),
      form: {
        filters: filters
      }
    };
  }
};
