const assert = require('assert');
const SignalResult = require('../../../../src/modules/strategy/dict/signal_result');

describe('#test signal object', function() {
  it('test that signal state is correct', () => {
    const signal = new SignalResult();

    assert.equal(signal.getSignal(), undefined);
    assert.deepEqual(signal.getDebug(), {});

    signal.setSignal('short');
    assert.equal(signal.getSignal(), 'short');

    signal.mergeDebug({ test: 'foobar' });
    signal.addDebug('test2', 'test');
    signal.addDebug('test', 'foobar2');
    signal.mergeDebug({ test3: 'foobar', test5: 'foobar' });

    assert.deepEqual(signal.getDebug(), {
      test: 'foobar2',
      test2: 'test',
      test3: 'foobar',
      test5: 'foobar'
    });
  });
});
