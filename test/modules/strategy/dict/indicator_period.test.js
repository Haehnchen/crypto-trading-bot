const assert = require('assert');
const IndicatorPeriod = require('../../../../src/modules/strategy/dict/indicator_period');

describe('#test indicator', function() {
  it('test that yield visiting is possible', () => {
    const ip = new IndicatorPeriod(
      {},
      {
        macd: [
          {
            test: 'test1'
          },
          {
            test: 'test2'
          },
          {
            test: 'test3'
          }
        ],
        sma: [1, 2, 3, 4, 5]
      }
    );

    const calls = [];

    for (const value of ip.visitLatestIndicators()) {
      calls.push(value);

      if (calls.length > 1) {
        break;
      }
    }

    assert.deepEqual({ macd: { test: 'test3' }, sma: 5 }, calls[0]);
    assert.deepEqual({ macd: { test: 'test2' }, sma: 4 }, calls[1]);
  });

  it('test that helper for latest elements are given', () => {
    const ip = new IndicatorPeriod(
      {},
      {
        macd: [
          {
            test: 'test1'
          },
          {
            test: 'test2'
          },
          {
            test: 'test3'
          }
        ],
        sma: [1, 2, 3, 4, 5]
      }
    );

    assert.deepEqual({ macd: { test: 'test3' }, sma: 5 }, ip.getLatestIndicators());
    assert.deepEqual(5, ip.getLatestIndicator('sma'));
  });
});
