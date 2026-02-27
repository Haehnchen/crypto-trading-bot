import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ConfigService } from '../system/config_service';
import { SandboxValidatorService, type TypeScriptError } from './sandbox_validator_service';
import { STRATEGY_SYSTEM_PROMPT, STRATEGY_GENERATION_PROMPT } from './strategy_prompts';
import type { Period } from '../../strategy/strategy';
import type { BacktestResult, BacktestConfigWithHours } from '../strategy/v2/typed_backtest';
import { TypedBacktestEngine } from '../strategy/v2/typed_backtest';
import type { ExchangeCandleCombine } from '../exchange/exchange_candle_combine';

export interface StrategyGenerationRequest {
  description: string;
  exchange: string;
  symbol: string;
  period: Period;
  candleCount: number;
  initialCapital?: number;
}

export interface StrategyGenerationResult {
  success: boolean;
  code?: string;
  strategyName?: string;
  validationErrors: string[];
  backtestResult?: BacktestResult;
  aiMessage?: string;
}

export class StrategyGeneratorService {
  constructor(
    private configService: ConfigService,
    private sandboxValidator: SandboxValidatorService,
    private exchangeCandleCombine: ExchangeCandleCombine,
    private backtestEngine: TypedBacktestEngine,
    private projectDir: string
  ) {}

  /**
   * Normalize baseURL for AI SDK - strip /chat/completions suffix if present
   */
  private normalizeBaseUrl(url: string): string {
    let baseUrl = url.trim();
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    if (baseUrl.endsWith('/chat/completions')) {
      baseUrl = baseUrl.slice(0, -'/chat/completions'.length);
    }
    return baseUrl;
  }

  /**
   * Generate a trading strategy using AI
   */
  async generateStrategy(request: StrategyGenerationRequest): Promise<StrategyGenerationResult> {
    const config = this.configService.getBotSettings().aiProvider;

    if (!config.baseUrl || !config.apiToken) {
      return {
        success: false,
        validationErrors: ['AI provider not configured. Please configure it in Settings > AI Provider.'],
      };
    }

    const baseUrl = this.normalizeBaseUrl(config.baseUrl);

    console.log('[StrategyGenerator] Starting generation', {
      baseUrl,
      model: config.model,
      exchange: request.exchange,
      symbol: request.symbol
    });

    try {
      const prompt = STRATEGY_GENERATION_PROMPT(request.description, request.exchange, request.symbol, request.period);
      const modelName = config.model || 'gpt-4';

      console.log('[StrategyGenerator] Calling AI model...', {
        baseUrl,
        model: modelName,
        promptLength: prompt.length,
      });

      const openai = createOpenAI({
        baseURL: baseUrl,
        apiKey: config.apiToken,
      });

      let model;
      try {
        model = openai.chat(modelName);
        console.log('[StrategyGenerator] Model instance created');
      } catch (modelError: any) {
        console.error('[StrategyGenerator] Model creation failed:', modelError);
        throw new Error(`Failed to create model: ${modelError.message}`);
      }

      console.log('[StrategyGenerator] Calling generateText...');

      let result;
      try {
        result = await generateText({
          model,
          system: STRATEGY_SYSTEM_PROMPT,
          prompt: prompt,
        });
      } catch (genError: any) {
        console.error('[StrategyGenerator] generateText error:', {
          message: genError.message,
          name: genError.name,
          cause: genError.cause,
        });

        if (genError.cause) {
          console.error('[StrategyGenerator] Error cause:', genError.cause);
        }

        throw genError;
      }

      console.log('[StrategyGenerator] AI response received:', {
        textLength: result.text?.length || 0,
        finishReason: result.finishReason,
        usage: result.usage
      });

      // Extract code from response
      let code: string | null = null;

      const tsMatch = result.text.match(/```(?:typescript|ts)\n([\s\S]*?)```/);
      if (tsMatch) {
        code = tsMatch[1].trim();
      }

      if (!code) {
        const codeMatch = result.text.match(/```\n?([\s\S]*?)```/);
        if (codeMatch) {
          code = codeMatch[1].trim();
        }
      }

      if (!code) {
        console.warn('[StrategyGenerator] No code block found in response');
        return {
          success: false,
          validationErrors: ['No valid TypeScript code found in AI response. Please try again.'],
          aiMessage: result.text,
        };
      }

      // Log the extracted code
      console.log('[StrategyGenerator] Extracted code:', {
        length: code.length,
        preview: code.substring(0, 500) + (code.length > 500 ? '...' : ''),
      });

      // Validate the code
      console.log('[StrategyGenerator] Validating code...');
      const validation = await this.validateCode(code);

      console.log('[StrategyGenerator] Validation result:', {
        success: validation.success,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        errors: validation.errors.slice(0, 5).map(e => `L${e.line}:C${e.column} - ${e.message}`),
        strategyName: validation.strategyName,
      });

      if (!validation.success) {
        console.warn('[StrategyGenerator] Validation failed:', validation.errors);
        return {
          success: false,
          code: code,
          strategyName: validation.strategyName,
          validationErrors: validation.errors.map(e => e.message),
          aiMessage: result.text,
        };
      }

      // Run backtest
      console.log('[StrategyGenerator] Running backtest...');
      const backtestResult = await this.runBacktest(code, {
        exchange: request.exchange,
        symbol: request.symbol,
        period: request.period,
        candleCount: request.candleCount,
        initialCapital: request.initialCapital,
      });

      console.log('[StrategyGenerator] Generation complete:', {
        success: true,
        strategyName: validation.strategyName,
      });

      return {
        success: true,
        code: code,
        strategyName: validation.strategyName,
        validationErrors: [],
        backtestResult: backtestResult.result,
        aiMessage: result.text,
      };
    } catch (e: any) {
      console.error('[StrategyGenerator] Generation failed:', {
        message: e.message,
        name: e.name,
        stack: e.stack?.split('\n').slice(0, 3).join('\n')
      });

      let errorMessage = e.message || 'Unknown error';

      if (e.message?.includes('401') || e.message?.includes('Unauthorized')) {
        errorMessage = 'Authentication failed. Please check your API token in Settings.';
      } else if (e.message?.includes('404') || e.message?.includes('Not Found')) {
        errorMessage = 'API endpoint not found. Please check your Base URL in Settings.';
      } else if (e.message?.includes('ENOTFOUND')) {
        errorMessage = 'Could not connect to the API. Please check the URL.';
      } else if (e.message?.includes('Debug Failure')) {
        errorMessage = 'AI SDK internal error. The API response format may be incompatible.';
      }

      return {
        success: false,
        validationErrors: [`AI generation failed: ${errorMessage}`],
      };
    }
  }

  /**
   * Validate strategy code only
   */
  async validateCode(code: string): Promise<{
    success: boolean;
    errors: TypeScriptError[];
    warnings: TypeScriptError[];
    strategyName?: string;
  }> {
    const validation = await this.sandboxValidator.validateTypeScript(code);
    let strategyName: string | undefined;

    if (validation.success && validation.compiledCode) {
      const imported = await this.sandboxValidator.importStrategy(validation.compiledCode);
      if (imported) {
        strategyName = imported.name;
        const structureCheck = this.sandboxValidator.validateStrategyStructure(imported.strategy);
        if (!structureCheck.valid) {
          return {
            success: false,
            errors: [...validation.errors, ...structureCheck.errors.map(e => ({
              line: 0,
              column: 0,
              message: e,
              code: 0
            }))],
            warnings: validation.warnings,
            strategyName
          };
        }
      }
    }

    return {
      success: validation.success,
      errors: validation.errors,
      warnings: validation.warnings,
      strategyName: strategyName || this.sandboxValidator.extractStrategyName(code)
    };
  }

  /**
   * Run backtest on validated code
   */
  async runBacktest(
    code: string,
    config: { exchange: string; symbol: string; period: Period; candleCount: number; initialCapital?: number }
  ): Promise<{ success: boolean; result?: BacktestResult; error?: string }> {
    const validation = await this.sandboxValidator.validateTypeScript(code);

    if (!validation.success || !validation.compiledCode) {
      return {
        success: false,
        error: 'Strategy validation failed: ' + validation.errors.map(e => e.message).join('; '),
      };
    }

    const imported = await this.sandboxValidator.importStrategy(validation.compiledCode);
    if (!imported) {
      return {
        success: false,
        error: 'Could not import strategy class',
      };
    }

    try {
      const backtestConfig: BacktestConfigWithHours = {
        exchange: config.exchange,
        symbol: config.symbol,
        period: config.period,
        hours: Math.ceil(config.candleCount * this.periodToMinutes(config.period) / 60),
        initialCapital: config.initialCapital || 1000,
      };

      const result = await this.backtestEngine.run(imported.strategy, backtestConfig);

      return {
        success: true,
        result,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
      };
    }
  }

  private periodToMinutes(period: Period): number {
    const map: Record<Period, number> = {
      '1m': 1,
      '3m': 3,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };
    return map[period] || 60;
  }
}
