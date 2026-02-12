export interface IndicatorDefinition {
  indicator: string | Function;
  key: string;
  period?: string;
  source?: string;
  options?: Record<string, any>;
}

export class IndicatorBuilder {
  private readonly indicators: Record<string, IndicatorDefinition>;

  constructor() {
    this.indicators = {};
  }

  add(key: string, indicator: string | Function, period?: string, options: Record<string, any> = {}, source?: string): void {
    this.indicators[key] = {
      indicator: indicator,
      key: key,
      period: period,
      source: source,
      options: options
    };
  }

  all(): IndicatorDefinition[] {
    return Object.keys(this.indicators).map(key => this.indicators[key]);
  }
}
