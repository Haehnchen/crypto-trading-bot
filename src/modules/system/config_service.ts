import * as fs from 'fs';
import * as path from 'path';

export interface Config {
  [key: string]: any;
}

// Dashboard types
export interface DashboardPair {
  exchange: string;
  symbol: string;
}

export interface DashboardConfig {
  periods: string[];
  pairs: DashboardPair[];
}

// Profile types
export interface Profile {
  id: string;
  name: string;
  exchange: string;
  apiKey?: string;
  secret?: string;
  bots?: Bot[];
}

export interface Bot {
  id: string;
  name: string;
  strategy: string;
  pair: string;
  interval: string;
  capital: number;
  mode: 'watch' | 'trade';
  status: 'stopped' | 'running';
  options?: Record<string, any>;
}

// Desk types
export interface Desk {
  name: string;
  [key: string]: any;
}

// Bot settings types
interface SlackConfig {
  webhook: string | null;
  name: string | null;
  icon_emoji: string | null;
}

interface MailConfig {
  to: string | null;
  username: string | null;
  password: string | null;
  server: string | null;
  port: number | null;
}

interface TelegramConfig {
  chat_id: string | null;
  token: string | null;
}

interface NotifyConfig {
  slack: SlackConfig;
  mail: MailConfig;
  telegram: TelegramConfig;
}

interface WebserverConfig {
  ip: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
}

// AI Provider types
export interface AIProviderConfig {
  name: string;
  baseUrl: string | null;
  apiToken: string | null;
  model: string;
}

export interface BotSettings {
  notify: NotifyConfig;
  webserver: WebserverConfig;
  aiProvider: AIProviderConfig;
}

// Defaults
const DEFAULT_DASHBOARD: DashboardConfig = {
  periods: ['15m', '1h'],
  pairs: []
};

const DEFAULT_NOTIFY: NotifyConfig = {
  slack: {
    webhook: null,
    name: null,
    icon_emoji: null
  },
  mail: {
    to: null,
    username: null,
    password: null,
    server: null,
    port: null
  },
  telegram: {
    chat_id: null,
    token: null
  }
};

const DEFAULT_WEBSERVER: WebserverConfig = {
  ip: null,
  port: null,
  username: null,
  password: null
};

const DEFAULT_AI_PROVIDER: AIProviderConfig = {
  name: 'default',
  baseUrl: null,
  apiToken: null,
  model: 'gpt-4'
};

export class ConfigService {
  private configFilePath: string;

  constructor(private readonly projectDir: string) {
    this.configFilePath = path.join(projectDir, 'var', 'config.json');
  }

  private readConfig(): Config {
    if (fs.existsSync(this.configFilePath)) {
      try {
        const content = fs.readFileSync(this.configFilePath, 'utf8');
        return JSON.parse(content);
      } catch (e) {
        console.error('Error reading config:', e);
      }
    }
    return {};
  }

  private writeConfig(config: Config): void {
    const varDir = path.dirname(this.configFilePath);
    if (!fs.existsSync(varDir)) {
      fs.mkdirSync(varDir, { recursive: true });
    }
    fs.writeFileSync(this.configFilePath, JSON.stringify(config, null, 2));
  }

  /**
   * Provide the configuration from var/config.json
   *
   * @param key eg "webserver.port" nested config supported
   * @param defaultValue value if config does not exists
   */
  getConfig(key: string, defaultValue?: any): any {
    const config = this.readConfig();
    const value = key.split('.').reduce((obj, k) => obj?.[k], config as any);

    if (value === null || value === undefined) {
      return defaultValue;
    }

    return value;
  }

  // ==================== Dashboard Config ====================

  getDashboardConfig(): DashboardConfig {
    const config = this.readConfig();
    const dashboard = config.dashboard || {};
    return {
      periods: dashboard.periods || DEFAULT_DASHBOARD.periods,
      pairs: dashboard.pairs || DEFAULT_DASHBOARD.pairs
    };
  }

  saveDashboardConfig(dashboard: DashboardConfig): void {
    const config = this.readConfig();
    config.dashboard = dashboard;
    this.writeConfig(config);
  }

  // ==================== Profiles (basic read/write only) ====================

  getProfiles(): Profile[] {
    const config = this.readConfig();
    return config.profiles || [];
  }

  saveProfiles(profiles: Profile[]): void {
    const config = this.readConfig();
    config.profiles = profiles;
    this.writeConfig(config);
  }

  // ==================== Desks ====================

  getDesks(): Desk[] {
    const config = this.readConfig();
    return config.desks || [];
  }

  saveDesks(desks: Desk[]): void {
    const config = this.readConfig();
    config.desks = desks;
    this.writeConfig(config);
  }

  // ==================== Bot Settings ====================

  getBotSettings(): BotSettings {
    const config = this.readConfig();
    return {
      notify: this.mergeNotify(config.notify),
      webserver: this.mergeWebserver(config.webserver),
      aiProvider: this.mergeAIProvider(config.aiProvider)
    };
  }

  saveBotSettings(settings: Partial<BotSettings>): void {
    const config = this.readConfig();
    if (settings.notify) {
      config.notify = settings.notify;
    }
    if (settings.webserver) {
      config.webserver = settings.webserver;
    }
    if (settings.aiProvider) {
      config.aiProvider = settings.aiProvider;
    }
    this.writeConfig(config);
  }

  // ==================== Helpers ====================

  private mergeNotify(notify: any): NotifyConfig {
    if (!notify) return { ...DEFAULT_NOTIFY };

    return {
      slack: {
        webhook: notify.slack?.webhook ?? DEFAULT_NOTIFY.slack.webhook,
        name: notify.slack?.name ?? DEFAULT_NOTIFY.slack.name,
        icon_emoji: notify.slack?.icon_emoji ?? DEFAULT_NOTIFY.slack.icon_emoji
      },
      mail: {
        to: notify.mail?.to ?? DEFAULT_NOTIFY.mail.to,
        username: notify.mail?.username ?? DEFAULT_NOTIFY.mail.username,
        password: notify.mail?.password ?? DEFAULT_NOTIFY.mail.password,
        server: notify.mail?.server ?? DEFAULT_NOTIFY.mail.server,
        port: notify.mail?.port ?? DEFAULT_NOTIFY.mail.port
      },
      telegram: {
        chat_id: notify.telegram?.chat_id ?? DEFAULT_NOTIFY.telegram.chat_id,
        token: notify.telegram?.token ?? DEFAULT_NOTIFY.telegram.token
      }
    };
  }

  private mergeWebserver(webserver: any): WebserverConfig {
    if (!webserver) return { ...DEFAULT_WEBSERVER };

    return {
      ip: webserver.ip ?? DEFAULT_WEBSERVER.ip,
      port: webserver.port ?? DEFAULT_WEBSERVER.port,
      username: webserver.username ?? DEFAULT_WEBSERVER.username,
      password: webserver.password ?? DEFAULT_WEBSERVER.password
    };
  }

  private mergeAIProvider(aiProvider: any): AIProviderConfig {
    if (!aiProvider) return { ...DEFAULT_AI_PROVIDER };

    return {
      name: aiProvider.name ?? DEFAULT_AI_PROVIDER.name,
      baseUrl: aiProvider.baseUrl ?? DEFAULT_AI_PROVIDER.baseUrl,
      apiToken: aiProvider.apiToken ?? DEFAULT_AI_PROVIDER.apiToken,
      model: aiProvider.model ?? DEFAULT_AI_PROVIDER.model
    };
  }
}
