import compression from 'compression';
import express from 'express';
import layouts from 'express-ejs-layouts';
import auth from 'basic-auth';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import path from 'path';
import { SystemUtil } from './system/system_util';
import { Services } from './services';
import { TemplateHelpers } from '../controller/base_controller';

export class Http {
  private systemUtil: SystemUtil;
  private projectDir: string;
  private services: Services;
  private templateHelpers: TemplateHelpers;

  constructor(systemUtil: SystemUtil, projectDir: string, services: Services) {
    this.systemUtil = systemUtil;
    this.projectDir = projectDir;
    this.services = services;

    // Helper functions for templates (previously Twig filters)
    this.templateHelpers = {
      priceFormat: (value: any): string => {
        if (parseFloat(value) < 1) {
          return Intl.NumberFormat('en-US', {
            useGrouping: false,
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
          }).format(value);
        }
        return Intl.NumberFormat('en-US', {
          useGrouping: false,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value);
      },
      formatDate: (date: any, format: string): string => {
        if (!date) return '';

        // Handle Unix timestamps (convert seconds to milliseconds if needed)
        let dateValue = date;
        if (typeof date === 'number' && date < 10000000000) {
          // If it's a number less than 10 billion, it's likely in seconds
          dateValue = date * 1000;
        }

        const d = new Date(dateValue);

        // Check if date is valid
        if (isNaN(d.getTime())) return '';

        if (format === 'Y-m-d H:i') {
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(
            2,
            '0'
          )}:${String(d.getMinutes()).padStart(2, '0')}`;
        } else if (format === 'y-m-d H:i:s') {
          return `${String(d.getFullYear()).slice(-2)}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(
            d.getHours()
          ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        } else if (format === 'd.m.y H:i') {
          return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getFullYear()).slice(-2)} ${String(
            d.getHours()
          ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
        return d.toISOString();
      },
      escapeHtml: (text: any): string => {
        if (typeof text !== 'string') return text;
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      },
      decodeHtml: (text: any): string => {
        if (typeof text !== 'string') return text;
        return text
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');
      },
      assetVersion: (): string => {
        return crypto
          .createHash('md5')
          .update(String(Math.floor(Date.now() / 1000)))
          .digest('hex')
          .substring(0, 8);
      },
      nodeVersion: (): string => process.version,
      memoryUsage: (): number => Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100
    };
  }

  start(): void {
    const app = express();

    // Configure EJS as template engine
    app.set('view engine', 'ejs');
    app.set('views', path.join(this.projectDir, 'views'));

    // Configure express-ejs-layouts FIRST
    app.use(layouts as any);
    app.set('layout', 'layout');
    app.set('layout extractScripts', true);
    app.set('layout extractStyles', true);

    // Helper middleware to add template helpers to all renders
    // This must come AFTER express-ejs-layouts
    app.use((req: any, res: any, next: any) => {
      res.locals = {
        ...res.locals,
        ...this.templateHelpers,
        desks: this.systemUtil.getConfig('desks', []).map((d: any) => d.name),
        nodeVersion: this.templateHelpers.nodeVersion(),
        memoryUsage: this.templateHelpers.memoryUsage(),
        assetVersion: this.templateHelpers.assetVersion()
      };
      next();
    });

    app.use(express.urlencoded({ limit: '12mb', extended: true, parameterLimit: 50000 }));
    app.use(cookieParser());
    app.use(compression());
    app.use(express.static(`${this.projectDir}/web/static`, { maxAge: 3600000 * 24 }));

    const username = this.systemUtil.getConfig('webserver.username');
    const password = this.systemUtil.getConfig('webserver.password');

    if (username && password) {
      app.use((request: any, response: any, next: any) => {
        const user = auth(request);

        if (!user || !(user.name === username && user.pass === password)) {
          response.set('WWW-Authenticate', 'Basic realm="Please Login"');
          return response.status(401).send();
        }

        return next();
      });
    }

    // Create a single main router that all controllers will register to
    // Controllers now define their full paths internally
    const mainRouter = express.Router();

    // Register all controller routes to the main router with full paths
    this.services.getDashboardController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getTradesController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getPairsController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getOrdersController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getSignalsController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getCandlesController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getBacktestController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getLogsController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getDesksController(this.templateHelpers).registerRoutes(mainRouter);
    this.services.getTradingViewController(this.templateHelpers).registerRoutes(mainRouter);

    // Mount the main router at root
    app.use('/', mainRouter);

    const ip = this.systemUtil.getConfig('webserver.ip', '0.0.0.0');
    const port = this.systemUtil.getConfig('webserver.port', 8080);

    app.listen(port, ip);

    console.log(`Webserver listening on: http://${ip}:${port}`);
  }
}
