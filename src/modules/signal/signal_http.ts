import { SignalRepository } from '../repository/signal_repository';

export class SignalHttp {
  private signalRepository: SignalRepository;

  constructor(signalRepository: SignalRepository) {
    this.signalRepository = signalRepository;
  }

  async getSignals(since: number): Promise<any[]> {
    return this.signalRepository.getSignals(since);
  }
}
