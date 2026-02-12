export interface SignalRepository {
  insertSignal(exchange: string, symbol: string, options: any, side: 'long' | 'short' | 'close', strategy: string): void;
}

export class SignalLogger {
  constructor(private signalRepository: SignalRepository) {}

  signal(exchange: string, symbol: string, options: any, side: 'long' | 'short' | 'close', strategy: string): void {
    this.signalRepository.insertSignal(exchange, symbol, options, side, strategy);
  }
}
