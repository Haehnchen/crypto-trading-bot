const Bitmex = require('./bitmex');

module.exports = class BitmexTestnet extends Bitmex {
  getName() {
    return 'bitmex_testnet';
  }

  getBaseUrl() {
    return 'https://testnet.bitmex.com';
  }
};
