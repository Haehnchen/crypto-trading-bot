# Backtest V2 Migration Plan

## Overview

Migrate from the old strategy/backtest system to the new typed v2 infrastructure, replacing the existing web UI backend while maintaining backward compatibility during transition.

## Current State

### Old System (v1)
- **Backtest Engine**: `src/modules/backtest.ts`
- **Strategy Manager**: `src/modules/strategy/strategy_manager.ts`
- **Strategies**: `src/modules/strategy/strategies/*.js`
- **Web Controller**: `src/controller/backtest_controller.ts`
- **Views**: `views/backtest.ejs`, `views/components/backtest_*.ejs`

### New System (v2)
- **Strategy Module**: `src/modules/strategy/v2/strategy.ts`
- **Backtest Engine**: `src/modules/strategy/v2/typed_backtest.ts`
- **Indicator Calculator**: `src/modules/strategy/v2/indicator_calculator.ts`
- **Strategies**: `src/modules/strategy/v2/strategies/*.ts`

---

## Migration Phases

### Phase 1: Strategy Migration Infrastructure

**Goal**: Create tools to help migrate existing strategies to v2 format.

#### 1.1 Strategy Registry
Create a central registry for v2 strategies to replace dynamic loading.

```typescript
// src/modules/strategy/v2/strategy_registry.ts
import { DcaDipperV2 } from './strategies/dca_dipper_v2';
// Import other migrated strategies here

export const strategyRegistry = {
  'dca_dipper_v2': DcaDipperV2,
  // Add more strategies as they are migrated
};

export type StrategyName = keyof typeof strategyRegistry;
export function getStrategyClass(name: StrategyName) {
  return strategyRegistry[name];
}
```

#### 1.2 Strategy Adapter (Optional)
Create an adapter to run old strategies in the new engine during transition.

```typescript
// src/modules/strategy/v2/legacy_adapter.ts
// Wraps old StrategyInfo interface to work with TypedBacktestEngine
```

---

### Phase 2: Web Controller Update

**Goal**: Update the web controller to use the new v2 backtest engine.

#### 2.1 Update BacktestController

File: `src/controller/backtest_controller.ts`

```typescript
// Before: Uses old Backtest module
import { Backtest } from '../modules/backtest';

// After: Uses TypedBacktestEngine
import { TypedBacktestEngine, formatBacktestTable } from '../modules/strategy/v2/typed_backtest';
import { strategyRegistry } from '../modules/strategy/v2/strategy_registry';
```

#### 2.2 New Controller Methods

- `GET /backtest` - Update to show v2 strategies in dropdown
- `POST /backtest/submit` - Route to v2 engine
- Keep legacy endpoint for old strategies: `POST /backtest/legacy/submit`

#### 2.3 Request/Response Format

```typescript
interface BacktestV2Request {
  exchange: string;
  symbol: string;
  period: Period;
  hours: number;
  initialCapital: number;
  strategy: StrategyName;
  options?: Record<string, any>;
}

interface BacktestV2Response {
  summary: BacktestSummary;
  trades: BacktestTrade[];
  rows: BacktestRow[];
  // For chart data
  chartData: {
    time: number;
    price: number;
    indicators: Record<string, number>;
    signal?: string;
    position?: string;
  }[];
}
```

---

### Phase 3: Strategy Migration

**Goal**: Migrate existing strategies one by one to v2 format.

#### 3.1 List of Strategies to Migrate

| Strategy | File | Status |
|----------|------|--------|
| dca_dipper | `strategies/dca_dipper.js` | ✅ Done |
| awake | `strategies/awake.js` | ⏳ Pending |
| breakout | `strategies/breakout.js` | ⏳ Pending |
| crossover | `strategies/crossover.js` | ⏳ Pending |
| ema_cross | `strategies/ema_cross.js` | ⏳ Pending |
| ... | ... | ... |

#### 3.2 Migration Template

For each strategy, create a new file in `src/modules/strategy/v2/strategies/`:

```typescript
import strategy, {
  StrategyBase,
  TypedStrategyContext,
  StrategySignal,
  type Period,
  type TypedIndicatorDefinition
} from '../strategy';

export interface XxxOptions {
  period: Period;
  // ... strategy-specific options
}

type XxxIndicators = {
  // ... indicator definitions
};

export class XxxV2 extends StrategyBase<XxxIndicators, XxxOptions> {
  getName(): string {
    return 'xxx_v2';
  }

  defineIndicators(): XxxIndicators {
    return {
      // ... indicator definitions using strategy.indicator.*
    };
  }

  async execute(
    context: TypedStrategyContext<XxxIndicators>,
    signal: StrategySignal
  ): Promise<void> {
    // ... strategy logic
  }

  getOptions(): XxxOptions {
    return {
      period: '15m',
      // ... defaults
    };
  }
}
```

---

### Phase 4: Frontend Updates

**Goal**: Update the web UI to work with v2 responses.

#### 4.1 Update Views

- `views/backtest.ejs` - Update strategy dropdown to use v2 strategy names
- `views/components/backtest_summary.ejs` - Already compatible
- `views/components/backtest_table.ejs` - Add indicator columns dynamically

#### 4.2 Chart Integration (Optional)

Add candlestick chart with indicators:

```javascript
// In backtest.ejs template
// Use Chart.js or similar to render:
// - Candlestick data
// - Indicator overlays (SMA, BB, etc.)
// - Buy/sell markers
```

---

### Phase 5: Cleanup

**Goal**: Remove old system once migration is complete.

#### 5.1 Deprecation Steps

1. Add deprecation warnings to v1 endpoints
2. Update documentation to recommend v2
3. Remove v1 code after all strategies migrated

#### 5.2 Files to Remove (After Migration Complete)

- `src/modules/backtest.ts`
- `src/modules/strategy/strategy_manager.ts`
- `src/modules/strategy/strategies/*.js` (old versions)
- Legacy adapter code

---

## Implementation Order

### Week 1: Foundation
1. ✅ Create v2 strategy module (`strategy.ts`)
2. ✅ Create v2 backtest engine (`typed_backtest.ts`)
3. ✅ Create indicator calculator (`indicator_calculator.ts`)
4. ✅ Migrate first strategy (`dca_dipper_v2`)
5. ⏳ Create strategy registry

### Week 2: Web Integration
1. ⏳ Update BacktestController for v2
2. ⏳ Update web views
3. ⏳ Test web UI with v2 engine

### Week 3-4: Strategy Migration
1. ⏳ Migrate remaining strategies (2-3 per day)
2. ⏳ Add to registry as migrated
3. ⏳ Test each migration

### Week 5: Cleanup
1. ⏳ Remove deprecated v1 code
2. ⏳ Update documentation
3. ⏳ Final testing

---

## Technical Decisions

### 1. Strategy Registry vs Dynamic Loading
**Decision**: Use explicit registry instead of dynamic file loading.
**Reason**:
- Better type safety
- Simpler debugging
- No runtime file system dependencies
- Works better with TypeScript compilation

### 2. Backward Compatibility
**Decision**: Keep v1 endpoints during transition.
**Reason**:
- Allows gradual migration
- No breaking changes for users
- Can test v2 thoroughly before removing v1

### 3. Indicator Columns in Output
**Decision**: Auto-detect from strategy's debug output.
**Reason**:
- No manual column configuration
- Works with any strategy
- Flexible for different indicator combinations

---

## Testing Strategy

### Unit Tests
- [ ] Test each migrated strategy independently
- [ ] Test indicator calculations match v1 results
- [ ] Test backtest engine edge cases

### Integration Tests
- [ ] Test web controller → backtest engine flow
- [ ] Test CLI command execution
- [ ] Test multiple strategies in one session

### Manual Testing
- [ ] Compare v1 vs v2 results for same strategy
- [ ] Test web UI responsiveness
- [ ] Test with real market data

---

## Rollback Plan

If issues arise:
1. Web controller can be reverted to use v1 engine
2. CLI has separate `backtest:v2` command, v1 unaffected
3. Each strategy migration is isolated

---

## Next Steps

1. Create `strategy_registry.ts`
2. Update `BacktestController` to support v2
3. Migrate 2-3 more strategies as proof of concept
4. Update web views
5. Continue strategy migration
