/**
 * Helper module for custom strategies in var/strategies/
 * Resolves paths correctly for both ts-node and compiled modes.
 *
 * Usage in your strategy (e.g., var/strategies/my_strategy.js):
 *
 *   const { SignalResult, IndicatorBuilder } = require('../../strategy_helpers');
 *
 * Or for specific imports:
 *   const helpers = require('../../strategy_helpers');
 *   const SignalResult = helpers.SignalResult;
 */

const path = require('path');

// Determine if we're running in compiled mode (dist/) or ts-node mode (src/)
const isInCompiledMode = __dirname.includes('/dist/src') ||
                         require('fs').existsSync(path.join(__dirname, 'dist', 'src')) ||
                         !require('fs').existsSync(path.join(__dirname, 'src', 'modules'));

// Base path for internal modules
const basePath = isInCompiledMode
  ? path.join(__dirname, 'dist', 'src')
  : path.join(__dirname, 'src');

/**
 * Require an internal module by path relative to src/
 */
function requireModule(modulePath) {
  const fullPath = path.join(basePath, modulePath);
  return require(fullPath);
}

// Export commonly used classes directly
module.exports = {
  // Direct access to resolve any module
  requireModule,

  // Commonly used classes (lazy-loaded)
  get SignalResult() {
    return requireModule('modules/strategy/dict/signal_result').SignalResult;
  },

  get StrategyContext() {
    return requireModule('dict/strategy_context').StrategyContext;
  },

  get IndicatorBuilder() {
    return requireModule('modules/strategy/dict/indicator_builder').IndicatorBuilder;
  },

  get IndicatorPeriod() {
    return requireModule('modules/strategy/dict/indicator_period').IndicatorPeriod;
  },

  get Position() {
    return requireModule('dict/position').Position;
  },

  get Order() {
    return requireModule('dict/order').Order;
  },
};
