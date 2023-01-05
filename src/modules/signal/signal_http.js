module.exports = class SignalHttp {
  constructor(signalRepository) {
    this.signalRepository = signalRepository;
  }

  async getSignals(since) {
    return this.signalRepository.getSignals(since);
  }
};
