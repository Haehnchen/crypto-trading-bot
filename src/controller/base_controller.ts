import express from 'express';

export interface Controller {
  registerRoutes(router: express.Router): void;
}

export interface TemplateHelpers {
  priceFormat(value: any): string;
  formatDate(date: any, format: string): string;
  escapeHtml(text: any): string;
  decodeHtml(text: any): string;
  assetVersion(): string;
  nodeVersion(): string;
  memoryUsage(): number;
}

export abstract class BaseController implements Controller {
  protected constructor(protected templateHelpers: TemplateHelpers) {}

  abstract registerRoutes(router: express.Router): void;

  protected render(res: express.Response, view: string, options: Record<string, any> = {}): void {
    res.render(view, {
      ...options,
      assetVersion: this.templateHelpers.assetVersion,
      nodeVersion: this.templateHelpers.nodeVersion,
      memoryUsage: this.templateHelpers.memoryUsage
    });
  }
}
