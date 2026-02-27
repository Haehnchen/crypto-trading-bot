/**
 * Strategy Builder Controller - Web UI for AI-powered strategy generation
 */

import { BaseController, TemplateHelpers } from './base_controller';
import { StrategyGeneratorService, type StrategyGenerationRequest } from '../modules/ai/strategy_generator_service';
import { SandboxValidatorService } from '../modules/ai/sandbox_validator_service';
import { ConfigService } from '../modules/system/config_service';
import { ProfilePairService } from '../modules/profile_pair_service';
import { TypedBacktestEngine, StrategyExecutor, type BacktestResult } from '../modules/strategy/v2/typed_backtest';
import { ExchangeCandleCombine } from '../modules/exchange/exchange_candle_combine';
import type { Period } from '../strategy/strategy';
import type express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as ccxt from 'ccxt';

export class StrategyBuilderController extends BaseController {
  private generatorService: StrategyGeneratorService;
  private sandboxValidator: SandboxValidatorService;
  private backtestEngine: TypedBacktestEngine;

  constructor(
    templateHelpers: TemplateHelpers,
    private configService: ConfigService,
    private profilePairService: ProfilePairService,
    private exchangeCandleCombine: ExchangeCandleCombine,
    private strategyExecutor: StrategyExecutor,
    private projectDir: string
  ) {
    super(templateHelpers);

    this.sandboxValidator = new SandboxValidatorService(projectDir);
    this.backtestEngine = new TypedBacktestEngine(exchangeCandleCombine, strategyExecutor);

    this.generatorService = new StrategyGeneratorService(
      configService,
      this.sandboxValidator,
      exchangeCandleCombine,
      this.backtestEngine,
      projectDir
    );
  }

  registerRoutes(router: express.Router): void {
    router.get('/strategy-builder', this.getIndex.bind(this));
    router.post('/strategy-builder/generate', this.generateStrategy.bind(this));
    router.post('/strategy-builder/validate', this.validateStrategy.bind(this));
    router.post('/strategy-builder/backtest', this.runBacktest.bind(this));
    router.post('/strategy-builder/save', this.saveStrategy.bind(this));
    router.get('/strategy-builder/exchanges', this.getExchanges.bind(this));
    router.get('/strategy-builder/symbols', this.getSymbols.bind(this));
  }

  /**
   * Render strategy builder page
   */
  private async getIndex(req: express.Request, res: express.Response): Promise<void> {
    const settings = this.configService.getBotSettings();
    const isAIConfigured = !!(settings.aiProvider.baseUrl && settings.aiProvider.apiToken);

    this.render(res, 'strategy_builder/index', {
      activePage: 'strategy-builder',
      activeSettingsPage: '',
      title: 'Strategy Builder | Crypto Bot',
      isAIConfigured,
      periods: ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'] as Period[],
    });
  }

  /**
   * Generate strategy via AI
   */
  private async generateStrategy(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { description, exchange, symbol, period, candleCount, initialCapital } = req.body;

      if (!description || !exchange || !symbol || !period) {
        res.status(400).json({
          success: false,
          validationErrors: ['Missing required fields: description, exchange, symbol, period'],
        });
        return;
      }

      const request: StrategyGenerationRequest = {
        description,
        exchange,
        symbol,
        period: period as Period,
        candleCount: parseInt(candleCount, 10) || 500,
        initialCapital: parseFloat(initialCapital) || 1000,
      };

      const result = await this.generatorService.generateStrategy(request);

      if (result.backtestResult) {
        res.json({
          ...result,
          backtestResult: this.formatBacktestForApi(result.backtestResult),
        });
      } else {
        res.json(result);
      }
    } catch (error) {
      console.error('[StrategyBuilder] Generation error:', error);
      res.status(500).json({
        success: false,
        validationErrors: [error instanceof Error ? error.message : 'Unknown error'],
      });
    }
  }

  /**
   * Validate strategy code
   */
  private async validateStrategy(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { code } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          errors: [{ line: 0, column: 0, message: 'No code provided', code: 0 }],
        });
        return;
      }

      const result = await this.generatorService.validateCode(code);
      res.json(result);
    } catch (error) {
      console.error('[StrategyBuilder] Validation error:', error);
      res.status(500).json({
        success: false,
        errors: [{ line: 0, column: 0, message: error instanceof Error ? error.message : 'Unknown error', code: 0 }],
      });
    }
  }

  /**
   * Run backtest on strategy code
   */
  private async runBacktest(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { code, exchange, symbol, period, candleCount, initialCapital } = req.body;

      if (!code || !exchange || !symbol || !period) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: code, exchange, symbol, period',
        });
        return;
      }

      const result = await this.generatorService.runBacktest(code, {
        exchange,
        symbol,
        period: period as Period,
        candleCount: parseInt(candleCount, 10) || 500,
        initialCapital: parseFloat(initialCapital) || 1000,
      });

      if (result.success && result.result) {
        res.json({
          success: true,
          result: this.formatBacktestForApi(result.result),
        });
      } else {
        res.json(result);
      }
    } catch (error) {
      console.error('[StrategyBuilder] Backtest error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Save strategy to var/strategies/ directory
   */
  private async saveStrategy(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { code, name } = req.body;

      if (!code) {
        res.status(400).json({
          success: false,
          error: 'No code provided',
        });
        return;
      }

      // Validate code before saving
      const validation = await this.generatorService.validateCode(code);
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: 'Strategy validation failed: ' + validation.errors.map(e => e.message).join('; '),
        });
        return;
      }

      // Generate filename from strategy name
      const strategyName = name || validation.strategyName || 'GeneratedStrategy';
      const fileName = this.toSnakeCase(strategyName) + '.ts';
      const strategiesDir = path.join(this.projectDir, 'var', 'strategies');

      // Ensure directory exists
      if (!fs.existsSync(strategiesDir)) {
        fs.mkdirSync(strategiesDir, { recursive: true });
      }

      const filePath = path.join(strategiesDir, fileName);

      // Check if file already exists
      if (fs.existsSync(filePath)) {
        res.status(400).json({
          success: false,
          error: `Strategy file "${fileName}" already exists. Choose a different name.`,
        });
        return;
      }

      // Write the file
      fs.writeFileSync(filePath, code, 'utf-8');

      console.log('[StrategyBuilder] Strategy saved:', filePath);

      res.json({
        success: true,
        path: filePath,
        fileName,
        strategyName,
      });
    } catch (error) {
      console.error('[StrategyBuilder] Save error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get available exchanges
   */
  private async getExchanges(req: express.Request, res: express.Response): Promise<void> {
    try {
      const popularExchanges = [
        'binance', 'bybit', 'okx', 'coinbase', 'kraken', 'kucoin',
        'bitget', 'gateio', 'mexc', 'htx', 'bitmart'
      ];

      let exchangeIds: string[];
      if (Array.isArray((ccxt as any).exchanges)) {
        exchangeIds = (ccxt as any).exchanges;
      } else {
        exchangeIds = Object.keys(ccxt).filter(key => {
          const val = (ccxt as any)[key];
          return typeof val === 'function' && val.prototype && key !== 'Exchange' && key[0] === key[0].toLowerCase();
        });
      }

      const sorted = exchangeIds.sort((a, b) => {
        const aIndex = popularExchanges.indexOf(a);
        const bIndex = popularExchanges.indexOf(b);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return a.localeCompare(b);
      });

      res.json(sorted.slice(0, 50).map(e => ({ value: e, text: e })));
    } catch (error) {
      console.error('[StrategyBuilder] Get exchanges error:', error);
      res.json([]);
    }
  }

  /**
   * Search symbols for exchange
   */
  private async getSymbols(req: express.Request, res: express.Response): Promise<void> {
    try {
      const exchangeId = (req.query.exchange as string || '').toLowerCase();
      const query = (req.query.q as string || '').toUpperCase();

      if (!exchangeId || query.length < 1) {
        res.json([]);
        return;
      }

      const markets = await this.profilePairService.getMarketsForExchange(exchangeId);
      const symbols = markets
        .filter((m: any) => m.active && !m.option && m.symbol.toUpperCase().includes(query))
        .slice(0, 20)
        .map((m: any) => ({ value: m.symbol, text: m.symbol }));

      res.json(symbols);
    } catch (error) {
      console.error('[StrategyBuilder] Get symbols error:', error);
      res.json([]);
    }
  }

  /**
   * Format backtest result for API response
   */
  private formatBacktestForApi(result: BacktestResult) {
    return {
      strategyName: result.strategyName,
      symbol: result.symbol,
      exchange: result.exchange,
      period: result.period,
      startTime: result.startTime,
      endTime: result.endTime,
      summary: {
        totalTrades: result.summary.totalTrades,
        profitableTrades: result.summary.profitableTrades,
        losingTrades: result.summary.losingTrades,
        winRate: result.summary.winRate.toFixed(2),
        totalProfitPercent: result.summary.totalProfitPercent.toFixed(2),
        averageProfitPercent: result.summary.averageProfitPercent.toFixed(2),
        maxDrawdown: result.summary.maxDrawdown.toFixed(2),
        sharpeRatio: result.summary.sharpeRatio.toFixed(2),
      },
      trades: result.trades.slice(0, 50).map((t: any) => ({
        entryTime: t.entryTime,
        exitTime: t.exitTime,
        entryPrice: t.entryPrice,
        exitPrice: t.exitPrice,
        side: t.side,
        profitPercent: t.profitPercent.toFixed(2),
        profitAbsolute: t.profitAbsolute.toFixed(2),
      })),
      indicatorKeys: result.indicatorKeys,
    };
  }

  /**
   * Convert camelCase/PascalCase to snake_case
   */
  private toSnakeCase(str: string): string {
    return str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
