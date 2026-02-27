import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { ConfigService, type AIProviderConfig } from '../system/config_service';
import type { Logger } from 'winston';

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  modelInfo?: string;
}

export class AIProviderService {
  constructor(
    private configService: ConfigService,
    private logger: Logger
  ) {}

  getConfig(): AIProviderConfig {
    const settings = this.configService.getBotSettings();
    return settings.aiProvider;
  }

  saveConfig(config: Partial<AIProviderConfig>): void {
    this.logger.info('[AIProviderService] Saving AI provider configuration', {
      baseUrl: config.baseUrl,
      model: config.model,
      hasToken: !!config.apiToken
    });

    const current = this.configService.getBotSettings();
    this.configService.saveBotSettings({
      ...current,
      aiProvider: {
        ...current.aiProvider,
        ...config
      }
    });
  }

  /**
   * Normalize baseURL for AI SDK - strip /chat/completions suffix if present
   * The AI SDK appends /chat/completions automatically
   */
  private normalizeBaseUrl(url: string): string {
    let baseUrl = url.trim();

    // Remove trailing slash
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    // Strip /chat/completions if present (AI SDK adds this automatically)
    if (baseUrl.endsWith('/chat/completions')) {
      baseUrl = baseUrl.slice(0, -'/chat/completions'.length);
    }

    return baseUrl;
  }

  /**
   * Test connection to the AI provider using AI SDK
   */
  async testConnection(config: { baseUrl: string; apiToken: string; model: string }): Promise<ConnectionTestResult> {
    this.logger.info('[AIProviderService] Testing connection', {
      baseUrl: config.baseUrl,
      model: config.model
    });

    if (!config.baseUrl) {
      return {
        success: false,
        message: 'Base URL is required',
      };
    }

    try {
      const baseUrl = this.normalizeBaseUrl(config.baseUrl);

      const openai = createOpenAI({
        baseURL: baseUrl,
        apiKey: config.apiToken || '',
      });

      const result = await generateText({
        model: openai.chat(config.model),
        prompt: 'Say "OK" if you can hear me.',
      });

      return {
        success: true,
        message: 'Connection successful! AI provider is responding.',
        modelInfo: config.model,
      };
    } catch (error: any) {
      this.logger.error('[AIProviderService] Connection test failed', {
        error: error.message,
        name: error.name,
        cause: error.cause
      });

      // Parse error message
      let errorMessage = error.message || 'Unknown error';

      if (error.cause?.code === 'ENOTFOUND') {
        errorMessage = `Host not found: ${error.cause.hostname}`;
      } else if (error.cause?.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused. Please check if the server is running.';
      } else if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        errorMessage = 'Connection timed out. Please check the URL.';
      } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = 'Authentication failed. Please check your API token.';
      } else if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        errorMessage = 'Endpoint not found. Please check the URL path (should end at /v1 or similar, not /chat/completions).';
      }

      return {
        success: false,
        message: `Connection failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get normalized base URL for AI SDK
   */
  getNormalizedBaseUrl(): string | null {
    const config = this.getConfig();
    if (!config.baseUrl) return null;
    return this.normalizeBaseUrl(config.baseUrl);
  }

  /**
   * Check if AI provider is configured and ready to use
   */
  isConfigured(): boolean {
    const config = this.getConfig();
    return !!(config && config.baseUrl && config.apiToken && config.model);
  }
}
