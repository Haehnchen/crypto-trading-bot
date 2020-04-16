const _ = require('lodash');

module.exports = class SystemUtil {
  constructor(config) {
    this.config = config;
  }

  /**
   * Provide the configuration inside "conf.json" with a comma separated access for array structures
   *
   * @param key eg "webserver.port" nested config supported
   * @param defaultValue value if config does not exists
   * @returns {*}
   */
  getConfig(key, defaultValue = undefined) {
    const value = _.get(this.config, key, defaultValue);

    if (value === null) {
      return defaultValue;
    }

    return value;
  }
};
