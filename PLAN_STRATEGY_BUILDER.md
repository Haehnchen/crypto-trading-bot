# AI Strategy Builder Implementation Plan

## Overview

This plan outlines the implementation of an AI-powered strategy generator feature for the crypto trading bot. The system will allow users to configure OpenAI-compatible API endpoints and use an AI agent to generate, validate, and test trading strategies.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Web UI                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Settings > AI Provider     │  Strategy Builder                             │
│  ┌─────────────────────┐    │  ┌─────────────────────────────────────────┐  │
│  │ • API URL           │    │  │ • Exchange/Symbol Selection             │  │
│  │ • API Token         │    │  │ • Period Selection                      │  │
│  │ • Test Button       │    │  │ • Candle Count                          │  │
│  │ • Save Button       │    │  │ • Strategy Description Input            │  │
│  └─────────────────────┘    │  │ • Generated Code Preview                │  │
│                             │  │ • Validation Results                    │  │
│                             │  │ • Backtest Results                      │  │
│                             │  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Backend Services                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────────┐  │
│  │ AI Provider      │    │ Strategy         │    │ Sandbox Validator    │  │
│  │ Service          │    │ Generator Agent  │    │                      │  │
│  │                  │    │                  │    │ • TypeScript Check   │  │
│  │ • Store config   │    │ • Uses AI SDK    │    │ • Strategy Import    │  │
│  │ • Test connection│    │ • Tool calling   │    │ • Backtest Run       │  │
│  └──────────────────┘    │ • Multi-step     │    │ • Error Feedback     │  │
│                          └──────────────────┘    └──────────────────────┘  │
│                                      │                    ▲                 │
│                                      │                    │                 │
│                                      ▼                    │                 │
│                          ┌──────────────────────────────────┐              │
│                          │         Agent Tools              │              │
│                          ├──────────────────────────────────┤              │
│                          │ • validateStrategy()             │              │
│                          │ • runBacktest()                  │              │
│                          │ • fetchCandles()                 │              │
│                          └──────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Phase 1: AI Provider Configuration

### 1.1 Database Schema

**File:** `src/utils/database_schema.ts`

Add new table for AI provider configuration:

```sql
CREATE TABLE IF NOT EXISTS ai_provider_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- Single row constraint
  name TEXT NOT NULL DEFAULT 'default',
  base_url TEXT NOT NULL,
  api_token TEXT NOT NULL,
  model TEXT DEFAULT 'gpt-4',
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### 1.2 Service Layer

**File:** `src/modules/ai/ai_provider_service.ts`

```typescript
export interface AIProviderConfig {
  id: number;
  name: string;
  baseUrl: string;
  apiToken: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export class AIProviderService {
  constructor(private db: Database) {}

  getConfig(): AIProviderConfig | null;
  saveConfig(config: Omit<AIProviderConfig, 'id' | 'createdAt' | 'updatedAt'>): void;
  testConnection(config: { baseUrl: string; apiToken: string; model: string }): Promise<{ success: boolean; message: string }>;
}
```

### 1.3 Settings Controller Updates

**File:** `src/controller/settings_controller.ts`

Add routes:
- `GET /settings/ai-provider` - Show AI provider configuration page
- `POST /settings/ai-provider` - Save configuration
- `POST /settings/ai-provider/test` - Test API connection

### 1.4 Settings View

**File:** `views/settings/ai_provider.ejs`

Form with:
- API Base URL input (e.g., `https://api.openai.com/v1`)
- API Token input (password field)
- Model selection (text input or dropdown)
- Test Connection button (AJAX call)
- Save button

### 1.5 Sidebar Update

**File:** `views/components/settings_sidebar.ejs`

Add link to AI Provider settings.

---

## Phase 2: Strategy Builder Page

### 2.1 Strategy Builder Controller

**File:** `src/controller/strategy_builder_controller.ts`

```typescript
export class StrategyBuilderController extends BaseController {
  registerRoutes(router: express.Router): void {
    router.get('/strategy-builder', this.getIndex.bind(this));
    router.post('/strategy-builder/generate', this.generateStrategy.bind(this));
    router.post('/strategy-builder/validate', this.validateStrategy.bind(this));
    router.post('/strategy-builder/backtest', this.runBacktest.bind(this));
    router.post('/strategy-builder/save', this.saveStrategy.bind(this));
  }
}
```

### 2.2 Strategy Builder View

**File:** `views/strategy_builder/index.ejs`

Layout with three columns/sections:

1. **Configuration Panel (Left)**
   - Exchange selector (dropdown from available exchanges)
   - Symbol input (with autocomplete like dashboard page)
   - Period selector (1m, 5m, 15m, 1h, 4h, 1d)
   - Candle count input (for backtesting)
   - Strategy description textarea (user's natural language description)

2. **Code Editor Panel (Center)**
   - Monaco Editor or CodeMirror for TypeScript code display
   - Syntax highlighting
   - Line numbers
   - Generated code appears here

3. **Results Panel (Right)**
   - TypeScript validation results (errors/warnings)
   - Backtest summary (win rate, profit, trades)
   - Trade list preview
   - Action buttons (Save Strategy, Run Again)

### 2.3 Navigation Update

Add "Strategy Builder" link to main navigation.

---

## Phase 3: AI Strategy Generator Agent

### 3.1 Strategy Generator Service

**File:** `src/modules/ai/strategy_generator_service.ts`

```typescript
export interface StrategyGenerationRequest {
  description: string;
  exchange: string;
  symbol: string;
  period: Period;
  candleCount: number;
}

export interface StrategyGenerationResult {
  code: string;
  strategyName: string;
  options: Record<string, any>;
  validationErrors: string[];
  backtestResult?: BacktestResult;
}

export class StrategyGeneratorService {
  constructor(
    private aiProviderService: AIProviderService,
    private sandboxValidator: SandboxValidatorService
  ) {}

  async generateStrategy(request: StrategyGenerationRequest): Promise<StrategyGenerationResult>;
}
```

### 3.2 AI Agent Implementation

**File:** `src/modules/ai/strategy_generator_agent.ts`

Using AI SDK v6 with tool calling:

```typescript
import { generateText, tool, stepCountIs } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// System prompt with strategy documentation
const STRATEGY_SYSTEM_PROMPT = `
You are an expert trading strategy developer. Generate TypeScript strategies for a cryptocurrency trading bot.

## Strategy Structure

All strategies must extend StrategyBase and implement:
1. getDescription(): string - Human-readable description
2. defineIndicators(): object - Define indicators to use
3. execute(context, signal): Promise<void> - Main trading logic

## Example Strategy

${EXAMPLE_STRATEGY_CODE}

## Available Indicators

${INDICATOR_DOCUMENTATION}

## Rules
1. Always use strategy.indicator.xxx() to define indicators
2. Access indicator values via context.getIndicator() or context.getLatestIndicator()
3. Use signal.goLong(), signal.goShort(), or signal.close() to emit signals
4. Add debug info with signal.debugAll({ key: value })
5. Define options interface with defaults in getDefaultOptions()
6. Handle null values from indicators during warmup period
`;

// Tools available to the agent
const validateStrategyTool = tool({
  description: 'Validate the generated TypeScript strategy code for type safety',
  inputSchema: z.object({
    code: z.string().describe('The TypeScript strategy code to validate'),
  }),
  execute: async ({ code }) => {
    // Call sandbox validator
  },
});

const runBacktestTool = tool({
  description: 'Run a backtest on the validated strategy',
  inputSchema: z.object({
    code: z.string(),
    exchange: z.string(),
    symbol: z.string(),
    period: z.string(),
    candleCount: z.number(),
  }),
  execute: async ({ code, exchange, symbol, period, candleCount }) => {
    // Run backtest in sandbox
  },
});

const fetchCandlesTool = tool({
  description: 'Fetch sample candles for reference',
  inputSchema: z.object({
    exchange: z.string(),
    symbol: z.string(),
    period: z.string(),
    count: z.number().optional(),
  }),
  execute: async ({ exchange, symbol, period, count }) => {
    // Fetch sample candles
  },
});
```

### 3.3 Multi-Step Agent Loop

The agent uses tool chaining with iteration:

```typescript
async function generateStrategyWithValidation(request: StrategyGenerationRequest): Promise<StrategyGenerationResult> {
  let iterations = 0;
  const maxIterations = 5;

  while (iterations < maxIterations) {
    const result = await generateText({
      model: openai.chat(config.model),
      system: STRATEGY_SYSTEM_PROMPT,
      prompt: `Generate a trading strategy for: ${request.description}
               Exchange: ${request.exchange}, Symbol: ${request.symbol}, Period: ${request.period}`,
      tools: {
        validateStrategy: validateStrategyTool,
        runBacktest: runBacktestTool,
        fetchCandles: fetchCandlesTool,
      },
      stopWhen: stepCountIs(10),
      maxRetries: 2,
    });

    // Check if validation passed
    // If backtest results are good, return
    // If errors, feed back to agent for correction

    iterations++;
  }
}
```

---

## Phase 4: Sandbox Validation Service

### 4.1 Sandbox Validator Service

**File:** `src/modules/ai/sandbox_validator_service.ts`

```typescript
export interface ValidationResult {
  success: boolean;
  errors: TypeScriptError[];
  warnings: TypeScriptError[];
  compiledCode?: string;
}

export interface TypeScriptError {
  line: number;
  column: number;
  message: string;
  code: string;
}

export class SandboxValidatorService {
  constructor(
    private projectDir: string,
    private exchangeCandleCombine: ExchangeCandleCombine,
    private backtestEngine: TypedBacktestEngine
  ) {}

  /**
   * Validate TypeScript code using tsc
   */
  async validateTypeScript(code: string): Promise<ValidationResult>;

  /**
   * Import and instantiate strategy class from validated code
   */
  async importStrategy(code: string): Promise<TypedStrategy<any>>;

  /**
   * Run backtest with the strategy
   */
  async runBacktest(
    code: string,
    config: { exchange: string; symbol: string; period: Period; candleCount: number }
  ): Promise<BacktestResult>;
}
```

### 4.2 TypeScript Validation Implementation

Two approaches:

**Option A: ts-morph (Recommended)**
```typescript
import { Project, SourceFile } from 'ts-morph';

async validateTypeScript(code: string): Promise<ValidationResult> {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: {
      strict: true,
      target: ScriptTarget.ES2020,
      moduleResolution: ModuleResolutionKind.NodeJs,
    },
  });

  // Add strategy.ts types
  const strategyTypes = fs.readFileSync('src/strategy/strategy.ts', 'utf-8');
  project.createSourceFile('strategy.ts', strategyTypes);

  // Create the strategy file
  const sourceFile = project.createSourceFile('generated_strategy.ts', code);

  // Get diagnostics
  const diagnostics = sourceFile.getPreEmitDiagnostics();

  return {
    success: diagnostics.length === 0,
    errors: diagnostics.map(d => ({
      line: d.getLine() || 0,
      column: d.getStart() || 0,
      message: d.getMessageText(),
      code: d.getCode(),
    })),
    warnings: [],
  };
}
```

**Option B: tsc --noEmit via child process**
```typescript
async validateTypeScript(code: string): Promise<ValidationResult> {
  const tempFile = path.join(os.tmpdir(), `strategy_${Date.now()}.ts`);

  // Write temp file
  fs.writeFileSync(tempFile, code);

  // Run tsc
  const result = spawnSync('npx', ['tsc', '--noEmit', tempFile], {
    cwd: this.projectDir,
    encoding: 'utf-8',
  });

  // Parse errors
  const errors = parseTypeScriptErrors(result.stderr);

  // Cleanup
  fs.unlinkSync(tempFile);

  return {
    success: result.status === 0,
    errors,
    warnings: [],
  };
}
```

### 4.3 Strategy Import and Execution

```typescript
async importStrategy(code: string): Promise<TypedStrategy<any>> {
  // Transpile TypeScript to JavaScript
  const transpiled = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });

  // Create isolated module
  const modulePath = path.join(os.tmpdir(), `strategy_${Date.now()}.js`);
  fs.writeFileSync(modulePath, transpiled.outputText);

  try {
    // Import the module
    const module = require(modulePath);
    const StrategyClass = Object.values(module).find(
      (exp: any) => exp.prototype instanceof StrategyBase
    );

    if (!StrategyClass) {
      throw new Error('No strategy class found in generated code');
    }

    return new (StrategyClass as any)();
  } finally {
    // Cleanup
    fs.unlinkSync(modulePath);
  }
}
```

---

## Phase 5: Prompt Engineering

### 5.1 Strategy Documentation for AI

**File:** `src/modules/ai/prompts/strategy_documentation.ts`

This file contains the complete documentation of the strategy system that will be fed to the AI:

```typescript
export const STRATEGY_SYSTEM_PROMPT = `
You are an expert trading strategy developer. Generate TypeScript strategies for a cryptocurrency trading bot.

## Project Structure

The bot uses a typed strategy system with the following key components:

### StrategyBase Class

All strategies must extend StrategyBase<TIndicators, TOptions>:

\`\`\`typescript
import strategy, {
  StrategyBase,
  TypedStrategyContext,
  StrategySignal,
  type TypedIndicatorDefinition,
  type MacdResult,
  type BollingerBandsResult,
  type StochResult
} from '../strategy';

// 1. Define your options interface
interface MyStrategyOptions {
  rsi_period?: number;
  rsi_overbought?: number;
  rsi_oversold?: number;
}

// 2. Define your indicators type
type MyStrategyIndicators = {
  rsi: TypedIndicatorDefinition<'rsi'>;
  sma: TypedIndicatorDefinition<'sma'>;
};

// 3. Create the strategy class
export class MyStrategy extends StrategyBase<MyStrategyIndicators, MyStrategyOptions> {

  getDescription(): string {
    return 'RSI mean reversion with SMA trend filter';
  }

  defineIndicators(): MyStrategyIndicators {
    return {
      rsi: strategy.indicator.rsi({ length: this.options.rsi_period }),
      sma: strategy.indicator.sma({ length: 200 }),
    };
  }

  async execute(context: TypedStrategyContext<MyStrategyIndicators>, signal: StrategySignal): Promise<void> {
    const { price, lastSignal } = context;

    // Get latest indicator values
    const rsi = context.getLatestIndicator('rsi');
    const sma = context.getLatestIndicator('sma');

    // Handle null during warmup
    if (rsi === null || sma === null) {
      return;
    }

    // Strategy logic
    const isTrendUp = price > sma;
    const isOversold = rsi < this.options.rsi_oversold;
    const isOverbought = rsi > this.options.rsi_overbought;

    signal.debugAll({ rsi: Math.round(rsi), sma: Math.round(sma), trend: isTrendUp ? 'up' : 'down' });

    // Entry logic
    if (context.isFlat()) {
      if (isTrendUp && isOversold) {
        signal.goLong();
      } else if (!isTrendUp && isOverbought) {
        signal.goShort();
      }
    }
    // Exit logic
    else if (context.isLong() && isOverbought) {
      signal.close();
    }
    else if (context.isShort() && isOversold) {
      signal.close();
    }
  }

  protected getDefaultOptions(): MyStrategyOptions {
    return {
      rsi_period: 14,
      rsi_overbought: 70,
      rsi_oversold: 30,
    };
  }
}
\`\`\`

### Available Indicators

Each indicator returns specific types:

| Indicator | Options | Return Type |
|-----------|---------|-------------|
| sma | { length?: number } | number[] |
| ema | { length?: number } | number[] |
| rsi | { length?: number } | number[] |
| cci | { length?: number } | number[] |
| macd | { fast_length?: number, slow_length?: number, signal_length?: number } | { macd, signal, histogram }[] |
| bb | { length?: number, stddev?: number } | { upper, middle, lower, width }[] |
| stoch | { length?: number, k?: number, d?: number } | { stoch_k, stoch_d }[] |
| adx | { length?: number } | number[] |
| atr | { length?: number } | number[] |
| obv | {} | number[] |
| psar | { step?: number, max?: number } | number[] |

### Context Methods

- context.price - Current candle close price
- context.lastSignal - 'long' | 'short' | 'close' | undefined
- context.isLong() - Check if currently in long position
- context.isShort() - Check if currently in short position
- context.isFlat() - Check if no position
- context.getIndicator(key) - Get full indicator array
- context.getLatestIndicator(key) - Get latest value
- context.getIndicatorSlice(key, count) - Get last N values

### Signal Methods

- signal.goLong() - Open long position
- signal.goShort() - Open short position
- signal.close() - Close current position
- signal.debugAll({ key: value }) - Add debug information
- signal.placeBuyOrder(amount, price) - For order-based strategies
- signal.placeSellOrder(amount, price) - For order-based strategies

## Generation Rules

1. Always include proper TypeScript imports
2. Define both Options and Indicators interfaces
3. Handle null values from indicators during warmup
4. Use meaningful variable names
5. Add debug information for troubleshooting
6. Implement getDefaultOptions() with sensible defaults
7. Never hardcode exchange/symbol/period - those are provided at runtime
8. Focus on the execute() logic for the strategy rules
`;

export const INDICATOR_DOCUMENTATION = `
// Full indicator list with type signatures
// (Include full type definitions from strategy.ts)
`;

export const EXAMPLE_STRATEGY_CODE = `
// Include full cci_macd.ts content
`;
```

---

## Phase 6: API Endpoints

### 6.1 Strategy Builder API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/strategy-builder` | GET | Strategy builder page |
| `/strategy-builder/generate` | POST | Generate strategy via AI |
| `/strategy-builder/validate` | POST | Validate TypeScript code |
| `/strategy-builder/backtest` | POST | Run backtest on strategy |
| `/strategy-builder/save` | POST | Save strategy to var/strategies/ |
| `/strategy-builder/exchanges` | GET | List available exchanges |
| `/strategy-builder/symbols` | GET | Search symbols for exchange |

### 6.2 Request/Response Formats

**Generate Strategy:**
```typescript
// POST /strategy-builder/generate
{
  description: "RSI mean reversion strategy with trend filter",
  exchange: "binance",
  symbol: "BTC/USDT",
  period: "1h",
  candleCount: 500
}

// Response (streaming)
{
  type: "code",  // | "validation" | "backtest" | "error"
  data: {
    code?: string,
    errors?: string[],
    backtest?: BacktestResult
  }
}
```

**Validate Strategy:**
```typescript
// POST /strategy-builder/validate
{
  code: "import strategy from ..."
}

// Response
{
  success: boolean,
  errors: Array<{ line, column, message, code }>,
  warnings: Array<{ line, column, message, code }>
}
```

**Run Backtest:**
```typescript
// POST /strategy-builder/backtest
{
  code: "...",
  exchange: "binance",
  symbol: "BTC/USDT",
  period: "1h",
  candleCount: 500,
  initialCapital: 1000
}

// Response
{
  summary: {
    totalTrades: number,
    winRate: number,
    totalProfitPercent: number,
    maxDrawdown: number,
    sharpeRatio: number
  },
  trades: BacktestTrade[],
  indicatorKeys: string[]
}
```

---

## Phase 7: Frontend Implementation

### 7.1 Strategy Builder Page Layout

```html
<div class="flex gap-4 h-[calc(100vh-120px)]">
  <!-- Left: Configuration -->
  <div class="w-72 shrink-0 bg-white rounded shadow p-4 overflow-y-auto">
    <h2>Configuration</h2>

    <!-- Exchange selector -->
    <!-- Symbol input with autocomplete -->
    <!-- Period dropdown -->
    <!-- Candle count input -->
    <!-- Strategy description textarea -->

    <button id="generate-btn">Generate Strategy</button>
  </div>

  <!-- Center: Code Editor -->
  <div class="flex-1 min-w-0 flex flex-col">
    <div class="bg-white rounded shadow flex-1 overflow-hidden">
      <div id="code-editor"></div>
    </div>

    <!-- Validation errors -->
    <div id="validation-errors" class="mt-2 bg-red-50 ..."></div>
  </div>

  <!-- Right: Results -->
  <div class="w-80 shrink-0 flex flex-col gap-4">
    <!-- Backtest summary -->
    <!-- Trade list -->
    <!-- Save button -->
  </div>
</div>
```

### 7.2 JavaScript Logic

```javascript
// Generate button handler
async function generateStrategy() {
  const config = {
    description: document.getElementById('description').value,
    exchange: document.getElementById('exchange').value,
    symbol: document.getElementById('symbol').value,
    period: document.getElementById('period').value,
    candleCount: parseInt(document.getElementById('candle-count').value)
  };

  // Show loading state
  showLoading();

  try {
    const response = await fetch('/strategy-builder/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });

    const result = await response.json();

    if (result.code) {
      editor.setValue(result.code);
    }

    if (result.backtestResult) {
      showBacktestResult(result.backtestResult);
    }

    if (result.validationErrors.length > 0) {
      showValidationErrors(result.validationErrors);
    }
  } finally {
    hideLoading();
  }
}
```

---

## Implementation Order

### Week 1: Foundation
1. [ ] Create AI provider config database table
2. [ ] Implement AIProviderService
3. [ ] Add AI Provider settings page (view + controller)
4. [ ] Test connection functionality
5. [ ] Update settings sidebar

### Week 2: Sandbox Validator
6. [ ] Implement SandboxValidatorService
7. [ ] TypeScript validation using ts-morph or tsc
8. [ ] Strategy import and instantiation
9. [ ] Backtest integration with existing engine
10. [ ] Error parsing and formatting

### Week 3: AI Agent
11. [ ] Create strategy documentation prompts
12. [ ] Implement StrategyGeneratorService
13. [ ] Define agent tools (validate, backtest, fetchCandles)
14. [ ] Multi-step agent loop with error correction
15. [ ] Response streaming support

### Week 4: Frontend
16. [ ] Create strategy builder page layout
17. [ ] Implement code editor (Monaco or CodeMirror)
18. [ ] Configuration panel with exchange/symbol selection
19. [ ] Results panel with backtest visualization
20. [ ] Save strategy functionality

### Week 5: Integration & Polish
21. [ ] End-to-end testing
22. [ ] Error handling and edge cases
23. [ ] Performance optimization
24. [ ] Documentation
25. [ ] Security review (API token storage, code execution sandbox)

---

## Files to Create/Modify

### New Files
```
src/
├── modules/
│   └── ai/
│       ├── ai_provider_service.ts
│       ├── strategy_generator_service.ts
│       ├── strategy_generator_agent.ts
│       ├── sandbox_validator_service.ts
│       └── prompts/
│           └── strategy_documentation.ts
├── controller/
│   └── strategy_builder_controller.ts
└── repository/
    └── ai_provider_repository.ts

views/
└── strategy_builder/
    └── index.ejs

views/settings/
└── ai_provider.ejs
```

### Modified Files
```
src/utils/database_schema.ts      # Add ai_provider_config table
src/modules/services.ts           # Register new services
src/controller/settings_controller.ts  # Add AI provider routes
views/components/settings_sidebar.ejs  # Add AI provider link
views/layout.ejs                  # Add nav link (optional)
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "ai": "^6.0.78",
    "@ai-sdk/openai": "^3.0.26",
    "ts-morph": "^21.0.0"
  }
}
```

---

## Security Considerations

1. **API Token Storage**: Encrypt tokens in database or use environment variables
2. **Code Execution Sandbox**: Run generated code in isolated process/VM
3. **Rate Limiting**: Limit AI API calls to prevent abuse
4. **Input Validation**: Sanitize all user inputs
5. **Code Review**: Generated strategies should be reviewed before production use

---

## Testing Strategy

1. **Unit Tests**
   - AIProviderService CRUD operations
   - SandboxValidator TypeScript parsing
   - Strategy import and instantiation

2. **Integration Tests**
   - AI connection test flow
   - Strategy generation with known prompts
   - Backtest execution with generated strategies

3. **E2E Tests**
   - Full flow from configuration to saved strategy
