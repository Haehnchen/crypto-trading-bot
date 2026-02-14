/**
 * Strategy Registry - Central registry for v2 typed strategies
 *
 * Supports:
 * - Built-in strategies (passed in constructor) - cached
 * - Dynamic strategies from files - loaded fresh each time, not cached
 * - Auto-discovery from var/strategies directory
 */

import fs from 'fs';
import path from 'path';
import type { TypedStrategy } from '../../../strategy/strategy';

// Register ts-node for loading .ts strategy files
require('ts-node/register');

// ============== Types ==============

/** Base type for strategy classes */
export type StrategyClassType = new (options: any) => TypedStrategy<any, any>;

/** Valid strategy names */
export type StrategyName = string;

/** Strategy class type */
export type StrategyClass<N extends StrategyName = StrategyName> = StrategyClassType;

/** Strategy instance type */
export type StrategyInstance<N extends StrategyName = StrategyName> = InstanceType<StrategyClass<N>>;

/** Strategy options type */
export type StrategyOptions<N extends StrategyName = StrategyName> = ConstructorParameters<StrategyClass<N>>[0];

/** Strategy info for display */
export interface StrategyInfo {
  name: string;
  displayName: string;
  description: string;
}

// ============== Registry Class ==============

export class StrategyRegistry {
  private builtInStrategies: StrategyClassType[] = [];

  constructor(builtInStrategies: StrategyClassType[] = []) {
    this.builtInStrategies = [...builtInStrategies];
  }

  // ============== File Resolution ==============

  /**
   * Resolve strategy name/path to a file path
   */
  private resolveFilePath(strategy: string): string | null {
    // Direct file path
    if (fs.existsSync(strategy)) {
      return strategy;
    }
    // var/strategies/{name}/{name}.ts
    const varPath = path.join('var/strategies', strategy, `${strategy}.ts`);
    if (fs.existsSync(varPath)) {
      return varPath;
    }
    // var/strategies/{name}.ts
    const flatPath = path.join('var/strategies', `${strategy}.ts`);
    if (fs.existsSync(flatPath)) {
      return flatPath;
    }
    return null;
  }

  /**
   * Discover all strategy files in var/strategies directory
   * Returns array of {name, filePath}
   */
  private discoverStrategyFiles(): { name: string; filePath: string }[] {
    const strategiesDir = path.join(process.cwd(), 'var/strategies');
    const results: { name: string; filePath: string }[] = [];

    if (!fs.existsSync(strategiesDir)) {
      return results;
    }

    const entries = fs.readdirSync(strategiesDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        // var/strategies/{name}/{name}.ts
        const strategyFile = path.join(strategiesDir, entry.name, `${entry.name}.ts`);
        if (fs.existsSync(strategyFile)) {
          results.push({ name: entry.name, filePath: strategyFile });
        }
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        // var/strategies/{name}.ts
        const strategyFile = path.join(strategiesDir, entry.name);
        const name = entry.name.replace('.ts', '');
        results.push({ name, filePath: strategyFile });
      }
    }

    return results;
  }

  // ============== Dynamic Loading ==============

  /**
   * Load a strategy class from file (fresh, not cached)
   */
  private loadFromFile(filePath: string): StrategyClassType {
    // Clear require cache to ensure fresh load
    const absolutePath = require.resolve(path.resolve(filePath));
    delete require.cache[absolutePath];

    // Require the file (ts-node handles .ts files)
    const moduleExports = require(absolutePath);

    // Find the strategy class - could be default export or named export
    let StrategyClass = moduleExports.default;

    // If no default, look for a class that can be instantiated
    if (!StrategyClass || typeof StrategyClass !== 'function') {
      for (const key of Object.keys(moduleExports)) {
        const exp = moduleExports[key];
        if (typeof exp === 'function' && exp.prototype) {
          try {
            const instance = new exp({});
            if (instance.getDescription && instance.defineIndicators && instance.execute) {
              StrategyClass = exp;
              break;
            }
          } catch {
            // Not a valid strategy class, continue
          }
        }
      }
    }

    if (!StrategyClass || typeof StrategyClass !== 'function') {
      throw new Error('Strategy file must export a class extending StrategyBase');
    }

    return StrategyClass;
  }

  // ============== Registry Methods ==============

  /**
   * Convert class name to strategy identifier
   * e.g., "DcaDipperV2" -> "dca_dipper_v2"
   */
  private classNameToId(className: string): string {
    return className
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '');
  }

  /**
   * Get strategy identifier from class
   */
  private getStrategyId(cls: StrategyClassType): string {
    return this.classNameToId(cls.name);
  }

  /**
   * Get list of all available strategy names (built-in + discovered from files)
   */
  getAvailableStrategies(): StrategyName[] {
    const names = this.builtInStrategies.map(cls => this.getStrategyId(cls));
    const discovered = this.discoverStrategyFiles().map(f => f.name);
    return [...names, ...discovered];
  }

  /**
   * Find a strategy class by name (loads fresh from file if not built-in)
   */
  getStrategyClass(name: StrategyName): StrategyClassType {
    // Check built-in strategies first
    const builtIn = this.builtInStrategies.find(cls => this.getStrategyId(cls) === name);
    if (builtIn) {
      return builtIn;
    }

    // Try to load from file (fresh)
    const filePath = this.resolveFilePath(name);
    if (filePath) {
      return this.loadFromFile(filePath);
    }

    const names = this.getAvailableStrategies().join(', ');
    throw new Error(`Unknown strategy: ${name}. Available: ${names}`);
  }

  /**
   * Create a strategy instance by name with options
   * Loads fresh from var/strategies if not a built-in strategy
   */
  createStrategy<N extends StrategyName>(name: N, options: StrategyOptions<N>): StrategyInstance<N> {
    const StrategyClass = this.getStrategyClass(name);
    // @ts-ignore
    return new StrategyClass(options) as StrategyInstance<N>;
  }

  /**
   * Check if a strategy name is valid
   */
  isValidStrategy(name: string): name is StrategyName {
    // Check built-in
    if (this.builtInStrategies.some(cls => this.getStrategyId(cls) === name)) {
      return true;
    }
    // Check if file exists
    return this.resolveFilePath(name) !== null;
  }

  /**
   * Get info for all strategies (discovers from var/strategies each time)
   */
  getAllStrategyInfo(): StrategyInfo[] {
    const infos: StrategyInfo[] = [];

    // Built-in strategies
    for (const cls of this.builtInStrategies) {
      const name = this.getStrategyId(cls);
      // @ts-ignore
      const instance = new cls({});
      infos.push({
        name,
        displayName: this.formatStrategyName(name),
        description: instance.getDescription(),
      });
    }

    // Discovered strategies from files (loaded fresh)
    for (const { name, filePath } of this.discoverStrategyFiles()) {
      try {
        const StrategyClass = this.loadFromFile(filePath);
        // @ts-ignore
        const instance = new StrategyClass({});
        infos.push({
          name,
          displayName: this.formatStrategyName(name),
          description: instance.getDescription(),
        });
      } catch (error) {
        console.error(`Failed to load strategy from ${filePath}:`, error);
      }
    }

    return infos;
  }

  /**
   * Format strategy name for display (convert snake_case to Title Case)
   */
  private formatStrategyName(name: string): string {
    return name
      .replace(/_v2$/, '')
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
