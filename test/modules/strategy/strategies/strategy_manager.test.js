let assert = require('assert')
let StrategyManager = require('../../../../modules/strategy/strategy_manager')
let StrategyContext = require('../../../../dict/strategy_context')
let TechnicalAnalysisValidator = require('../../../../utils/technical_analysis_validator')
let Ticker = require('../../../../dict/ticker')
let fs = require('fs');

describe('#strategy manager', () => {
    it('strategy cci', async () => {
        let strategyManager = new StrategyManager(createTechnicalAnalysisValidator(), createCandlestickRepository())

        let result = await strategyManager.executeStrategy('cci', createStrategyContext(), 'foobar', 'BTCUSD', {'period': '15m'})
        assert.equal(undefined, result['signal'])
    });

    it('strategy macd', async () => {
        let strategyManager = new StrategyManager(createTechnicalAnalysisValidator(), createCandlestickRepository())

        let result = await strategyManager.executeStrategy('macd', createStrategyContext(), 'foobar', 'BTCUSD', {'period': '15m'})
        assert.equal(undefined, result['signal'])
    });

    let createCandlestickRepository = () => {
        return {
            fetchCombinedCandles: async (exchange) => {
                return {
                    [exchange]: createCandleFixtures()
                }
            }
        }
    }

    let createCandleFixtures = () => {
        return JSON.parse(fs.readFileSync(__dirname + '/../../../utils/fixtures/xbt-usd-5m.json', 'utf8'));
    }

    let createStrategyContext = () => {
        return new StrategyContext(new Ticker('goo', 'goo', 'goo', 6000, 6000))
    }

    let createTechnicalAnalysisValidator = () => {
        let technicalAnalysisValidator = new TechnicalAnalysisValidator()

        technicalAnalysisValidator.isValidCandleStickLookback = function() {
            return true
        }

        return technicalAnalysisValidator
    }
})
