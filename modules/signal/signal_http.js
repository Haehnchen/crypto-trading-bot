'use strict';

module.exports = class SignalHttp {
    constructor(signalRepository) {
        this.signalRepository = signalRepository
    }

    async getSignals(since) {
        return await this.signalRepository.getSignals(since);
    }
};