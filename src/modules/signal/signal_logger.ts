export interface SignalRepository {
  insertSignal(exchange: string, symbol: string, options: any, side: 'long' | 'short' | 'close', strategy: string): void;
}

export class SignalLogger {
  private signalRepository: SignalRepository;

  constructor(signalRepository: SignalRepository) {
    this.signalRepository = signalRepository;
  }

  signal(exchange: string, symbol: string, options: any, side: 'long' | 'short' | 'close', strategy: string): void {
    this.signalRepository.insertSignal(exchange, symbol, options, side, strategy);
  }
}
