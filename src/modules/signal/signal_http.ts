import { SignalRepository } from '../../repository';

export class SignalHttp {
  constructor(private signalRepository: SignalRepository) {}

  async getSignals(since: number): Promise<any[]> {
    return this.signalRepository.getSignals(since);
  }
}
