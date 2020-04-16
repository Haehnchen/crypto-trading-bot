const services = require('../modules/services');

module.exports = class ServerCommand {
  constructor() {}

  execute() {
    services.createWebserverInstance().start();
  }
};
