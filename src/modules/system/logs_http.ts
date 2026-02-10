import _ from 'lodash';
import { LogsRepository } from '../repository/logs_repository';

export class LogsHttp {
  private logsRepository: LogsRepository;

  constructor(logsRepository: LogsRepository) {
    this.logsRepository = logsRepository;
  }

  async getLogsPageVariables(request: any, response: any): Promise<any> {
    let excludeLevels: string[] = request.query.exclude_levels || [];

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
}
