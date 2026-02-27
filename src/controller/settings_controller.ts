import { BaseController, TemplateHelpers } from './base_controller';
import { ConfigService } from '../modules/system/config_service';
import { AIProviderService } from '../modules/ai/ai_provider_service';
import express from 'express';
import os from 'os';
import fs from 'fs';
import path from 'path';

export class SettingsController extends BaseController {
  private aiProviderService: AIProviderService;

  constructor(
    templateHelpers: TemplateHelpers,
    private configService: ConfigService
  ) {
    super(templateHelpers);
    // Create a simple logger for AIProviderService
    this.aiProviderService = new AIProviderService(
      configService,
      {
        info: (msg: string, meta?: any) => console.log(`[AIProvider] ${msg}`, meta || ''),
        error: (msg: string, meta?: any) => console.error(`[AIProvider] ${msg}`, meta || ''),
      } as any
    );
  }

  registerRoutes(router: express.Router): void {
    router.get('/settings', this.getIndex.bind(this));
    router.get('/settings/webserver', this.getWebserver.bind(this));
    router.post('/settings/webserver', this.saveWebserver.bind(this));
    router.get('/settings/notifications', this.getNotifications.bind(this));
    router.post('/settings/notifications', this.saveNotifications.bind(this));
    router.get('/settings/ai-provider', this.getAIProvider.bind(this));
    router.post('/settings/ai-provider', this.saveAIProvider.bind(this));
    router.post('/settings/ai-provider/test', this.testAIProvider.bind(this));
  }

  private getIndex(req: express.Request, res: express.Response): void {
    const sysInfo = this.getSystemInfo();

    this.render(res, 'settings/index', {
      activePage: 'settings',
      activeSettingsPage: '',
      title: 'Settings | Crypto Bot',
      sysInfo
    });
  }

  private getSystemInfo() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpus = os.cpus();
    const uptimeSec = os.uptime();

    const dbPath = path.join(this.configService['projectDir'], 'var', 'bot.db');
    let dbSize: number | null = null;
    try {
      dbSize = fs.statSync(dbPath).size;
    } catch (_) {}

    let diskTotal: number | null = null;
    let diskFree: number | null = null;
    try {
      const stat = (fs as any).statfsSync('/');
      diskTotal = stat.blocks * stat.bsize;
      diskFree = stat.bfree * stat.bsize;
    } catch (_) {}

    return {
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usedPercent: Math.round((usedMem / totalMem) * 100)
      },
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model?.replace(/\s+/g, ' ').trim() ?? 'Unknown'
      },
      disk: diskTotal !== null && diskFree !== null
        ? {
            total: diskTotal,
            free: diskFree,
            used: diskTotal - diskFree,
            usedPercent: Math.round(((diskTotal - diskFree) / diskTotal) * 100)
          }
        : null,
      db: {
        path: dbPath,
        size: dbSize
      },
      uptime: uptimeSec,
      processUptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform()
    };
  }

  private getWebserver(req: express.Request, res: express.Response): void {
    const settings = this.configService.getBotSettings();
    const saved = req.query.saved === '1';

    this.render(res, 'settings/webserver', {
      activePage: 'settings',
      activeSettingsPage: 'webserver',
      title: 'Webserver Settings | Crypto Bot',
      settings,
      saved
    });
  }

  private saveWebserver(req: express.Request, res: express.Response): void {
    const body = req.body;
    const current = this.configService.getBotSettings();

    const settings = {
      ...current,
      webserver: {
        ip: this.nullIfEmpty(body.webserver_ip),
        port: this.parseIntOrNull(body.webserver_port),
        username: this.nullIfEmpty(body.webserver_username),
        password: this.nullIfEmpty(body.webserver_password)
      }
    };

    this.configService.saveBotSettings(settings);
    res.redirect('/settings/webserver?saved=1');
  }

  private getNotifications(req: express.Request, res: express.Response): void {
    const settings = this.configService.getBotSettings();
    const saved = req.query.saved === '1';

    this.render(res, 'settings/notifications', {
      activePage: 'settings',
      activeSettingsPage: 'notifications',
      title: 'Notification Settings | Crypto Bot',
      settings,
      saved
    });
  }

  private saveNotifications(req: express.Request, res: express.Response): void {
    const body = req.body;
    const current = this.configService.getBotSettings();

    const settings = {
      ...current,
      notify: {
        slack: {
          webhook: this.nullIfEmpty(body.slack_webhook),
          name: this.nullIfEmpty(body.slack_name),
          icon_emoji: this.nullIfEmpty(body.slack_icon_emoji)
        },
        mail: {
          to: this.nullIfEmpty(body.mail_to),
          username: this.nullIfEmpty(body.mail_username),
          password: this.nullIfEmpty(body.mail_password),
          server: this.nullIfEmpty(body.mail_server),
          port: this.parseIntOrNull(body.mail_port)
        },
        telegram: {
          chat_id: this.nullIfEmpty(body.telegram_chat_id),
          token: this.nullIfEmpty(body.telegram_token)
        }
      }
    };

    this.configService.saveBotSettings(settings);
    res.redirect('/settings/notifications?saved=1');
  }

  private getAIProvider(req: express.Request, res: express.Response): void {
    const settings = this.configService.getBotSettings();
    const saved = req.query.saved === '1';
    const testResult = req.query.testResult ? JSON.parse(req.query.testResult as string) : null;

    this.render(res, 'settings/ai_provider', {
      activePage: 'settings',
      activeSettingsPage: 'ai-provider',
      title: 'AI Provider Settings | Crypto Bot',
      settings,
      saved,
      testResult
    });
  }

  private saveAIProvider(req: express.Request, res: express.Response): void {
    const body = req.body;

    const settings = {
      aiProvider: {
        name: 'default',
        baseUrl: this.nullIfEmpty(body.ai_base_url),
        apiToken: this.nullIfEmpty(body.ai_api_token),
        model: body.ai_model || 'gpt-4'
      }
    };

    this.configService.saveBotSettings(settings);
    res.redirect('/settings/ai-provider?saved=1');
  }

  private async testAIProvider(req: express.Request, res: express.Response): Promise<void> {
    const body = req.body || {};
    const { baseUrl, apiToken, model } = body;

    if (!baseUrl) {
      res.json({ success: false, message: 'Base URL is required' });
      return;
    }

    const result = await this.aiProviderService.testConnection({
      baseUrl,
      apiToken: apiToken || '',
      model: model || 'gpt-4'
    });

    res.json(result);
  }

  private nullIfEmpty(value: string | undefined): string | null {
    if (!value || value.trim() === '') {
      return null;
    }
    return value.trim();
  }

  private parseIntOrNull(value: string | undefined): number | null {
    if (!value || value.trim() === '') {
      return null;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }
}
