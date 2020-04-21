module.exports = class SignalLogger {
  constructor(signalRepository) {
    this.signalRepository = signalRepository;
  }

  signal(exchange, symbol, options, side, strategy) {
    this.signalRepository.insertSignal(exchange, symbol, options, side, strategy);
  }
};
