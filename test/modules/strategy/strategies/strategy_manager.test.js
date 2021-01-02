const assert = require('assert');
const fs = require('fs');
const StrategyManager = require('../../../../src/modules/strategy/strategy_manager');
const StrategyContext = require('../../../../src/dict/strategy_context');
const TechnicalAnalysisValidator = require('../../../../src/utils/technical_analysis_validator');
const Ticker = require('../../../../src/dict/ticker');

describe('#strategy manager', () => {
  it('strategy cci', async () => {
    const strategyManager = new StrategyManager(createTechnicalAnalysisValidator(), createCandlestickRepository());

    const result = await strategyManager.executeStrategy('cci', createStrategyContext(), 'foobar', 'BTCUSD', {
      period: '15m'
    });
    assert.equal(undefined, result.signal);
  });

  it('strategy macd', async () => {
    const strategyManager = new StrategyManager(createTechnicalAnalysisValidator(), createCandlestickRepository());

    const result = await strategyManager.executeStrategy('macd', createStrategyContext(), 'foobar', 'BTCUSD', {
      period: '15m'
    });
    assert.equal(undefined, result.signal);
  });

  let createCandlestickRepository = () => {
    return {
      fetchCombinedCandles: async exchange => {
        return {
          [exchange]: createCandleFixtures()
        };
      }
    };
  };

  let createCandleFixtures = () => {
    return JSON.parse(fs.readFileSync(`${__dirname}/../../../utils/fixtures/xbt-usd-5m.json`, 'utf8'));
  };

  let createStrategyContext = () => {
    return new StrategyContext({}, new Ticker('goo', 'goo', 'goo', 6000, 6000));
  };

  let createTechnicalAnalysisValidator = () => {
    const technicalAnalysisValidator = new TechnicalAnalysisValidator();

    technicalAnalysisValidator.isValidCandleStickLookback = function() {
      return true;
    };

    return technicalAnalysisValidator;
  };
});
