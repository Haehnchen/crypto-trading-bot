import _ from 'lodash';

export interface Config {
  [key: string]: any;
}

export class SystemUtil {
  constructor(private readonly config: Config) {}

  /**
   * Provide the configuration inside "conf.json" with a comma separated access for array structures
   *
   * @param key eg "webserver.port" nested config supported
   * @param defaultValue value if config does not exists
   */
  getConfig(key: string, defaultValue?: any): any {
    const value = _.get(this.config, key, defaultValue);

    if (value === null) {
      return defaultValue;
    }

    return value;
  }
}
