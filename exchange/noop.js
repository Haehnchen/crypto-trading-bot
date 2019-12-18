/**
 * An dummy exchange
 *
 * @type {module.Noop}
 */
module.exports = class Noop {
  constructor() {}

  start(config, symbols) {}

  getName() {
    return 'noop';
  }
};
